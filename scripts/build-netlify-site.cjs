"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");

const publicFiles = [
  "index.html",
  "app-native-bridge.js",
  "app-update.js",
  "market-price-guide.js",
  "market-price-guide.css",
  "market_prices_yemen.json",
  "regional-catalog-runtime.js",
  "marketplace-client.js",
  "market_items.json",
  "features-2.1.js",
  "features-2.1.css",
  "v3.0.0.js",
  "v3.0.0.css",
  "jobs-feed.json",
  "manifest.json",
  "version.json",
  "sw.js",
  "regions-yemen.js",
  "regions-profiles.js",
  "privacy.html",
  "terms.html",
  "regional-catalog/manifest.json",
  "regional-catalog/search_index_light.json"
];

const publicDirectories = ["icons", "market-price-images", "regional-catalog"];

function copyFile(relativePath) {
  const source = path.join(root, relativePath);
  const target = path.join(dist, relativePath);
  if (!fs.existsSync(source) || !fs.statSync(source).isFile()) {
    throw new Error("Required public asset is missing: " + relativePath);
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

function run() {
  fs.rmSync(dist, { recursive: true, force: true });
  fs.mkdirSync(dist, { recursive: true });

  for (const relativePath of publicFiles) copyFile(relativePath);
  for (const relativePath of publicDirectories) {
    const source = path.join(root, relativePath);
    if (!fs.existsSync(source) || !fs.statSync(source).isDirectory()) {
      throw new Error("Required public asset directory is missing: " + relativePath);
    }
    fs.cpSync(source, path.join(dist, relativePath), {
      recursive: true,
      filter: sourcePath => {
        const stat = fs.statSync(sourcePath);
        return stat.isDirectory() || path.extname(sourcePath).toLowerCase() === ".json"
          || path.extname(sourcePath).toLowerCase() === ".svg";
      }
    });
  }

  fs.writeFileSync(path.join(dist, ".nojekyll"), "");
  const required = ["index.html", "jobs-feed.json", "version.json", "regional-catalog/search_index_light.json"];
  for (const relativePath of required) {
    if (!fs.existsSync(path.join(dist, relativePath))) {
      throw new Error("Netlify output is missing " + relativePath);
    }
  }
  const publishedHtml = fs.readFileSync(path.join(dist, "index.html"), "utf8");
  if (!publishedHtml.includes('id="dalilna-netlify-badge-guard"') ||
      !publishedHtml.includes('id="dalilna-netlify-badge-guard-script"')) {
    throw new Error("The Netlify badge guard CSS/JavaScript must be present in the published homepage.");
  }

  process.stdout.write(JSON.stringify({
    publishDirectory: "dist",
    staticFiles: publicFiles.length,
    publicDirectories,
    containsJobsFeed: true,
    containsVersionMetadata: true,
    containsNationalSearchIndex: true
  }, null, 2) + "\n");
}

run();
