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
