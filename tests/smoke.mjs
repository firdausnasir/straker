import { chromium } from "playwright";

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

try {
  // --- register ---
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Create one" }).click();
  await page.fill("#email", email);
  await page.fill("#password", "supersecret");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(`${BASE}/`, { timeout: 10000 });
  log("✓ registered + on dashboard");

  // --- open quick-add ---
  await page.getByRole("button", { name: "Add commitment" }).click();
  await page.waitForSelector("#name", { timeout: 5000 });
  log("✓ quick-add dialog opened");

  // --- fill + submit, capture the create response ---
  await page.fill("#name", "Playwright Sub");
  await page.fill("#amount", "23.50");
  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith("/api/commitments") && r.request().method() === "POST", { timeout: 10000 }),
    page.getByRole("button", { name: /Create|Add to ledger|Update/ }).click(),
  ]);
  log(`✓ POST /api/commitments -> ${resp.status()}`);

  // --- confirm it appears in the list ---
  await page.waitForSelector("text=Playwright Sub", { timeout: 8000 });
  log("✓ commitment appears in list");

  // --- exercise the sort menu (the Base UI group fix) ---
  await page.getByRole("button", { name: "Sort", exact: false }).first().click();
  await page.waitForSelector("text=Sort by", { timeout: 5000 });
  await page.getByRole("menuitemradio", { name: "Amount" }).click();
  log("✓ sort menu opened + selected Amount (no crash)");

  // --- payment accounts: create account + card ---
  await page.goto(`${BASE}/accounts`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Add an account" }).first().click();
  await page.fill("#account-name", "Maybank");
  await page.getByRole("dialog").getByRole("button", { name: "Add account" }).click();
  await page.waitForSelector("text=Maybank", { timeout: 8000 });
  log("✓ payment account created");

  // Expand the account to reveal its card actions (header toggles the list).
  await page.getByRole("button", { name: /Maybank/ }).click();
  await page.getByRole("button", { name: "Add card" }).first().click();
  await page.fill("#card-label", "Personal Visa");
  await page.fill("#card-last4", "4242");
  await page.getByRole("dialog").getByRole("button", { name: "Add card" }).click();
  await page.waitForSelector("text=Personal Visa", { timeout: 8000 });
  log("✓ card added to account");

  // --- add a commitment linked to that card ---
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Add commitment" }).click();
  await page.waitForSelector("#name", { timeout: 5000 });
  await page.fill("#name", "Linked Sub");
  await page.fill("#amount", "10.00");

  // Two-step picker: account select, then dependent card select. Target each
  // field by its label container + the Base UI trigger slot.
  const accountField = page.locator('div.space-y-1\\.5:has(label:has-text("Account"))');
  await accountField.locator('[data-slot="select-trigger"]').click();
  await page.getByRole("option", { name: "Maybank" }).click();
  const cardField = page.locator('div.space-y-1\\.5:has(label:has-text("Card"))');
  await cardField.locator('[data-slot="select-trigger"]').click();
  await page.getByRole("option", { name: /Personal Visa/ }).click();

  const [linkResp] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().endsWith("/api/commitments") && r.request().method() === "POST",
      { timeout: 10000 },
    ),
    page.getByRole("dialog").getByRole("button", { name: /Create|Add to ledger/ }).click(),
  ]);
  log(`✓ POST linked commitment -> ${linkResp.status()}`);

  // Card link now lives in the expandable detail (compact rows) — open the row.
  await page.waitForSelector("text=Linked Sub", { timeout: 8000 });
  await page.getByRole("button", { name: /Linked Sub/ }).first().click();
  await page.waitForSelector("text=·4242", { timeout: 8000 });
  log("✓ linked commitment shows account/card on the card");

  // --- open the collapsed filter panel + account multi-select (must not crash;
  //     the page.on('pageerror') listener catches Base UI context throws) ---
  await page.getByRole("button", { name: "Filters", exact: false }).first().click();
  await page.getByRole("button", { name: "Filter by account" }).click();
  await page.waitForSelector("text=Filter by account", { timeout: 5000 });
  await page.getByRole("menuitemcheckbox", { name: "Maybank" }).click();
  await page.keyboard.press("Escape");
  log("✓ filter panel + account multi-select opened (no crash)");

  // --- delete the card → commitment must survive, unlinked (US8) ---
  await page.goto(`${BASE}/accounts`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Delete Personal Visa" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete card" }).click();
  await page.waitForSelector("text=Personal Visa", { state: "detached", timeout: 8000 });
  log("✓ card deleted");

  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Linked Sub", { timeout: 8000 });
  // Expand the row so the card-link detail would be visible if it still existed.
  await page.getByRole("button", { name: /Linked Sub/ }).first().click();
  if ((await page.locator("text=·4242").count()) !== 0) {
    throw new Error("card link still shown after card delete — SetNull failed");
  }
  log("✓ commitment survived card delete, now unlinked (US8)");

  // --- delete the account → cascades cards, commitment intact (US9) ---
  await page.goto(`${BASE}/accounts`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Delete", exact: true }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete account" }).click();
  await page.waitForSelector("text=Maybank", { state: "detached", timeout: 8000 });
  log("✓ account deleted (cascade)");

  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Linked Sub", { timeout: 8000 });
  log("✓ commitment intact after account delete (US9)");

  // --- open date picker to ensure it doesn't submit/crash ---
  await page.getByRole("button", { name: "Add commitment" }).click();
  await page.waitForSelector("#name", { timeout: 5000 });
  await page.click("#due");
  await page.waitForSelector(".rdp-root, [data-slot=calendar]", { timeout: 5000 });
  log("✓ date picker opened (calendar visible)");
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
