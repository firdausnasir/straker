import { chromium } from "playwright";

// End-to-end passkey lifecycle using a CDP virtual authenticator (no real
// device / Bitwarden needed): register a user → add a passkey → name it →
// sign out → sign in with the passkey. Run a fresh prod/dev server first, then:
//   BASE=http://localhost:3199 node tests/passkey-smoke.mjs
const BASE = process.env.BASE ?? "http://localhost:3199";
const email = `pk_${Date.now()}@example.com`;
const password = "supersecret";
const errors = [];
const log = (s) => console.log(s);

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

// Surface every passkey API response status — this is where the 500 showed up.
page.on("response", (r) => {
  if (r.url().includes("/api/passkey/")) {
    log(`  ↳ ${r.request().method()} ${new URL(r.url()).pathname} -> ${r.status()}`);
    if (r.status() >= 400) errors.push(`${new URL(r.url()).pathname} -> ${r.status()}`);
  }
});

// Virtual authenticator: a platform passkey with resident-key + UV support.
const client = await context.newCDPSession(page);
await client.send("WebAuthn.enable");
await client.send("WebAuthn.addVirtualAuthenticator", {
  options: {
    protocol: "ctap2",
    transport: "internal",
    hasResidentKey: true,
    hasUserVerification: true,
    isUserVerified: true,
    automaticPresenceSimulation: true,
  },
});

try {
  // --- register + sign in ---
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Create one" }).click();
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(`${BASE}/`, { timeout: 10000 });
  log("✓ registered + on dashboard");

  // --- add a passkey from Settings ---
  await page.goto(`${BASE}/settings`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Add a passkey" }).click();
  await page.waitForSelector("#pk-password", { timeout: 5000 });
  await page.fill("#pk-password", password);

  const [verifyResp] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().endsWith("/api/passkey/register/verify") && r.request().method() === "POST",
      { timeout: 15000 },
    ),
    page.getByRole("button", { name: "Continue" }).click(),
  ]);
  log(`✓ register/verify -> ${verifyResp.status()} (was 500 before the fix)`);

  // --- naming modal pre-filled with the guess; edit + save ---
  await page.waitForSelector("#pk-rename", { timeout: 8000 });
  const guessed = await page.inputValue("#pk-rename");
  log(`✓ naming modal pre-filled with guess: "${guessed}"`);
  await page.fill("#pk-rename", "My Test Passkey");
  // Wait for the rename PATCH before navigating, else goto aborts it.
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().endsWith("/api/passkey/credential") && r.request().method() === "PATCH",
      { timeout: 10000 },
    ),
    page.getByRole("button", { name: "Save" }).click(),
  ]);

  // --- confirm it persisted ---
  await page.goto(`${BASE}/settings`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=My Test Passkey", { timeout: 8000 });
  log("✓ passkey saved + shown in Settings");

  // --- renew: same UX as add (password → ceremony → naming modal) ---
  await page.getByRole("button", { name: "Renew" }).click();
  await page.waitForSelector("#pk-password", { timeout: 5000 });
  await page.fill("#pk-password", password);
  const [renewResp] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().endsWith("/api/passkey/register/verify") && r.request().method() === "POST",
      { timeout: 15000 },
    ),
    page.getByRole("button", { name: "Continue" }).click(),
  ]);
  log(`✓ renew register/verify -> ${renewResp.status()}`);
  await page.waitForSelector("#pk-rename", { timeout: 8000 });
  await page.fill("#pk-rename", "Renewed Passkey");
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().endsWith("/api/passkey/credential") && r.request().method() === "PATCH",
      { timeout: 10000 },
    ),
    page.getByRole("button", { name: "Save" }).click(),
  ]);
  await page.goto(`${BASE}/settings`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Renewed Passkey", { timeout: 8000 });
  log("✓ renewed passkey saved + shown in Settings");

  // --- sign out ---
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL(`${BASE}/login`, { timeout: 10000 });
  log("✓ signed out");

  // --- sign in with the passkey ---
  await page.getByRole("button", { name: "Sign in with a passkey" }).click();
  await page.waitForURL(`${BASE}/`, { timeout: 15000 });
  log("✓ signed in with passkey → on dashboard");
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
console.log("\n✓ ALL PASSKEY CHECKS PASSED");
