import { chromium } from "playwright";

// End-to-end smoke for the collapsed single-layer PaymentAccount + default
// account. Covers the 8 steps in the PRD's Testing Decisions: last4 render,
// at-most-one default, create-prefill from default, edit-keeps-its-own-account,
// unset default, and both schema SetNull paths (account delete → commitment
// unlinked; default account delete → User.defaultAccountId cleared).
const BASE = process.env.BASE ?? "http://localhost:3944";
const email = `pw_${Date.now()}@example.com`;
const errors = [];

const browser = await chromium.launch();
const page = await browser.newPage();
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
});

const log = (s) => console.log(s);

// The commitment dialog's account picker trigger (scoped to the "Account" field
// so it never collides with the type/currency/cycle selects).
const acctTrigger = () =>
  page.locator('div.space-y-1\\.5:has(label:has-text("Account")) [data-slot="select-trigger"]');

// Poll the picker trigger until it shows the expected label (it starts at "No
// account" and flips once /api/accounts resolves the default).
async function expectPickerLabel(expected) {
  await page
    .locator(`div.space-y-1\\.5:has(label:has-text("Account")) [data-slot="select-trigger"]:has-text("${expected}")`)
    .waitFor({ timeout: 8000 });
}

// Pick an account in the open commitment dialog by its option label.
async function pickAccount(nameRe) {
  await acctTrigger().click();
  await page.getByRole("option", { name: nameRe }).click();
}

async function createAccount(name, last4) {
  await page.getByRole("button", { name: "Add an account" }).first().click();
  await page.fill("#account-name", name);
  if (last4) {
    await page.fill("#account-last4", last4);
  }
  await page.getByRole("dialog").getByRole("button", { name: "Add account" }).click();
  await page.getByRole("button", { name: `Edit ${name}` }).waitFor({ timeout: 8000 });
}

// Default state is read off the toggle button, which is the component's own
// source of truth: "Set X as default" renders only when X is NOT the default;
// "Remove X as default" only when it IS.
const setDefaultBtn = (name) => page.getByRole("button", { name: `Set ${name} as default` });
const unsetDefaultBtn = (name) => page.getByRole("button", { name: `Remove ${name} as default` });

async function setDefault(name) {
  await setDefaultBtn(name).click();
  await unsetDefaultBtn(name).waitFor({ timeout: 8000 });
}

try {
  // --- register ---
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Create one" }).click();
  await page.fill("#email", email);
  await page.fill("#password", "supersecret");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(`${BASE}/`, { timeout: 10000 });
  log("✓ registered + on dashboard");

  // === STEP 1: create Account A (with last4) → set as default ===
  await page.goto(`${BASE}/accounts`, { waitUntil: "networkidle" });
  await createAccount("Account A", "4242");
  // A must render with its last4 chip.
  await page.getByText("·4242", { exact: false }).first().waitFor({ timeout: 8000 });
  await setDefault("Account A");
  // Default badge present (and the row is now the only default).
  if ((await page.getByText("Default", { exact: true }).count()) !== 1) {
    throw new Error("expected exactly one Default badge after setting A");
  }
  log("✓ step 1: Account A created with last4 chip, marked default");

  // === STEP 2: create Account B (no last4) → set default, A loses it ===
  await createAccount("Account B", null);
  // B has no last4 → still exactly one "·4242" on the page (A's only).
  if ((await page.getByText("·4242", { exact: false }).count()) !== 1) {
    throw new Error("Account B rendered a last4 chip it should not have");
  }
  await setDefault("Account B");
  // At-most-one: B is now default AND A's set-button reappeared (A lost default).
  await setDefaultBtn("Account A").waitFor({ timeout: 8000 });
  if ((await page.getByText("Default", { exact: true }).count()) !== 1) {
    throw new Error("more than one Default badge — at-most-one invariant broken");
  }
  log("✓ step 2: Account B default, A lost its badge (at-most-one holds)");

  // === STEP 3: create-commitment picker prefilled with default (B); pick A ===
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Add commitment" }).click();
  await page.waitForSelector("#name", { timeout: 5000 });
  await expectPickerLabel("Account B");
  log("✓ step 3a: new-commitment picker prefilled with default (Account B)");
  await page.fill("#name", "Linked Sub");
  await page.fill("#amount", "10.00");
  await pickAccount(/Account A/);
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().endsWith("/api/commitments") && r.request().method() === "POST",
      { timeout: 10000 },
    ),
    page.getByRole("dialog").getByRole("button", { name: "Create" }).click(),
  ]);
  log("✓ step 3b: picked Account A (override default) + saved");

  // === STEP 4: dashboard shows the commitment with Account A · 4242 ===
  await page.getByText("Linked Sub").first().waitFor({ timeout: 8000 });
  await page.getByRole("button", { name: /Linked Sub/ }).first().click();
  await page.getByText("·4242", { exact: false }).first().waitFor({ timeout: 8000 });
  await page.getByText("Account A", { exact: false }).first().waitFor({ timeout: 8000 });
  log("✓ step 4: expanded card shows Account A ·4242");

  // === STEP 5: edit keeps its own account (A), never flips to default (B) ===
  await page.getByRole("button", { name: "Edit commitment" }).first().click();
  await page.waitForSelector("#name", { timeout: 5000 });
  await expectPickerLabel("Account A"); // starts on A, NOT default B
  await Promise.all([
    page.waitForResponse(
      (r) => /\/api\/commitments\/[^/]+$/.test(r.url()) && r.request().method() === "PATCH",
      { timeout: 10000 },
    ),
    page.getByRole("dialog").getByRole("button", { name: "Save changes" }).click(),
  ]);
  // PATCH returns { ok: true } (no accountId), so prove the link survived by
  // re-reading the rendered meta — it must still show A's ·4242, not B.
  await page.getByRole("button", { name: /Linked Sub/ }).first().click();
  await page.getByText("·4242", { exact: false }).first().waitFor({ timeout: 8000 });
  log("✓ step 5: edit kept Account A (no silent flip to default B)");

  // === STEP 6: unset default on B → picker then starts on "No account" ===
  await page.goto(`${BASE}/accounts`, { waitUntil: "networkidle" });
  await unsetDefaultBtn("Account B").click();
  await setDefaultBtn("Account B").waitFor({ timeout: 8000 });
  if ((await page.getByText("Default", { exact: true }).count()) !== 0) {
    throw new Error("Default badge still present after unset");
  }
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Add commitment" }).click();
  await page.waitForSelector("#name", { timeout: 5000 });
  // B is still alive, so "No account" genuinely reflects the cleared default.
  await page.waitForResponse((r) => r.url().endsWith("/api/accounts"), { timeout: 8000 }).catch(() => {});
  await expectPickerLabel("No account");
  await page.keyboard.press("Escape");
  log("✓ step 6: default unset → create picker starts on No account");

  // === STEP 7: re-set B; delete A → commitment unlinked, default still B ===
  await page.goto(`${BASE}/accounts`, { waitUntil: "networkidle" });
  await setDefault("Account B");
  await page.getByRole("button", { name: "Delete Account A" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete account" }).click();
  await page.getByRole("button", { name: "Edit Account A" }).waitFor({ state: "detached", timeout: 8000 });
  // Default unaffected by A's deletion.
  await unsetDefaultBtn("Account B").waitFor({ timeout: 8000 });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.getByText("Linked Sub").first().waitFor({ timeout: 8000 });
  await page.getByRole("button", { name: /Linked Sub/ }).first().click();
  if ((await page.getByText("·4242", { exact: false }).count()) !== 0) {
    throw new Error("commitment still linked after its account was deleted (SetNull failed)");
  }
  log("✓ step 7: commitment unlinked on account delete (SetNull); default still B");

  // === STEP 8: delete B (the default) → default cleared (User SetNull) ===
  await page.goto(`${BASE}/accounts`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Delete Account B" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete account" }).click();
  await page.getByText("No accounts yet").waitFor({ timeout: 8000 });
  // Prove the cleared default leaves no residual prefill: a brand-new account C
  // must NOT auto-become the default. If User.defaultAccountId still pointed at
  // (deleted) B, the create picker would have to resolve a dangling default —
  // it instead starts on "No account", and C is not silently promoted.
  await createAccount("Account C", null);
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Add commitment" }).click();
  await page.waitForSelector("#name", { timeout: 5000 });
  await page.waitForResponse((r) => r.url().endsWith("/api/accounts"), { timeout: 8000 }).catch(() => {});
  await expectPickerLabel("No account");
  log("✓ step 8: default account deleted → default cleared, new account not promoted (SetNull)");
} catch (e) {
  errors.push(`flow failure: ${e.message}`);
} finally {
  await browser.close();
}

if (errors.length) {
  console.log("\n✗ ERRORS:");
  for (const e of errors) console.log("  - " + e);
  process.exit(1);
}
console.log("\n✓ ALL CHECKS PASSED — no console/page errors");
