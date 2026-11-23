"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { test } = require("node:test");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "../..");
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon"
};

function createStaticServer() {
  return http.createServer((request, response) => {
    try {
      const url = new URL(request.url, "http://127.0.0.1");
      const decoded = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
      const file = path.resolve(ROOT, "." + decoded);
      if (file !== ROOT && !file.startsWith(ROOT + path.sep)) {
        response.writeHead(403).end("Forbidden");
        return;
      }
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
        response.writeHead(404).end("Not found");
        return;
      }
      response.writeHead(200, {
        "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff"
      });
      fs.createReadStream(file).pipe(response);
    } catch {
      response.writeHead(400).end("Bad request");
    }
  });
}

test("merchant profile, shop submission and directory favourites work in a real browser", {
  timeout: 90000
}, async () => {
  const server = createStaticServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const origin = "http://127.0.0.1:" + address.port;

  let browser;
  let marketplacePayload = null;
  const pageErrors = [];

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ serviceWorkers: "block" });
    const page = await context.newPage();
    page.on("pageerror", error => pageErrors.push(error.message));

    // Keep the journey deterministic and offline. Only the shared listing POST is stubbed.
    await page.route("**/*", async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin === origin) return route.continue();
      if (url.pathname === "/api/marketplace/listings" && request.method() === "POST") {
        marketplacePayload = request.postDataJSON();
        return route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({ id: "e2e-shared-listing-1", status: "pending" })
        });
      }
      return route.abort();
    });

    await page.goto(origin + "/index.html", { waitUntil: "domcontentloaded" });
    await page.locator("#accountDlg").waitFor({ state: "visible", timeout: 15000 });

    const merchantName = "متجر دليلنا لاختبار المتصفح";
    const merchantPhone = "771234567";
    await page.locator("#roleMerchantBtn").click();
    await page.locator("#merchName").fill(merchantName);
    await page.locator("#merchPhone").fill(merchantPhone);
    await page.locator("#merchSave").click();
    await page.locator("#merchantToolsPanel").waitFor({ state: "visible" });

    const shopName = "Dalilna E2E Shop";
    await page.locator("#merchantAddBtn").click();
    await page.locator("#dlg").waitFor({ state: "visible" });
    await page.locator('#f input[name="name"]').fill(shopName);
    await page.locator('#f input[name="phone"]').fill(merchantPhone);
    await page.locator("#save").click();

    const shopCard = page.locator("#list .card").filter({ hasText: shopName }).first();
    await shopCard.waitFor({ state: "visible", timeout: 15000 });
    const shopId = await shopCard.getAttribute("data-open");
    assert.ok(shopId, "The submitted shop should have a local listing identifier.");

    await shopCard.locator("[data-fav]").click();
    let saved = await page.evaluate(() => JSON.parse(localStorage.getItem("dalilna_app_v6") || "{}"));
    assert.ok(saved.items.some(item => item.id === shopId && item.name === shopName), "The new shop should be stored locally.");
    assert.ok(saved.favs.includes(shopId), "The shop should be stored in directory favourites.");
    assert.equal(marketplacePayload?.title, shopName, "The shared marketplace API should receive the shop title.");
    assert.equal(marketplacePayload?.phone, merchantPhone, "The shared marketplace API should receive the submitted contact number.");

    await page.reload({ waitUntil: "domcontentloaded" });
    saved = await page.evaluate(() => JSON.parse(localStorage.getItem("dalilna_app_v6") || "{}"));
    assert.ok(saved.items.some(item => item.id === shopId), "The shop should survive an app reload.");
    assert.ok(saved.favs.includes(shopId), "The favourite should survive an app reload.");

    await page.locator("#accountBtn").click();
    await page.locator("#accountDlg").waitFor({ state: "visible" });
    await page.locator("#roleMerchantBtn").click();
    assert.equal(await page.locator("#merchName").inputValue(), merchantName, "The merchant profile should be restored from local storage.");
    assert.equal(await page.locator("#merchPhone").inputValue(), merchantPhone, "The merchant phone should be restored from local storage.");

    assert.deepEqual(pageErrors, [], "The tested browser journey should not produce uncaught JavaScript errors.");
    await context.close();
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});
