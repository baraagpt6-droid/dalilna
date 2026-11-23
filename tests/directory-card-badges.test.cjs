"use strict";
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const web = fs.readFileSync(path.join(root, "index.html"), "utf8");
const android = fs.readFileSync(path.join(root, "android/app/src/main/assets/index.html"), "utf8");

test("public-source directory cards use a compact badge instead of a long blanket warning", () => {
  assert.ok(web.includes('<small class="where">المصدر: ${esc(i.sourceName)}</small> <span class="verification-badge">دليل مفتوح</span>'));
  assert.ok(!web.includes("بيانات عامة قد تتغير. تحقق من النشاط قبل الشراء أو الزيارة."));
  assert.equal(android, web, "Android WebView must use the same updated cards as the PWA");
});
