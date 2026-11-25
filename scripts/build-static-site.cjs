"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const output = path.join(root, "dist");

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
  "app-ads.txt",
  "store/index.html",
  "regional-catalog/manifest.json",
  "regional-catalog/search_index_light.json"
];

const publicDirectories = ["icons", "market-price-images", "regional-catalog"];

function copyFile(relativePath) {
  const source = path.join(root, relativePath);
  const target = path.join(output, relativePath);
  if (!fs.existsSync(source) || !fs.statSync(source).isFile()) {
    throw new Error("Required public asset is missing: " + relativePath);
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

function copyPublicDirectory(relativePath) {
  const source = path.join(root, relativePath);
  const target = path.join(output, relativePath);
  if (!fs.existsSync(source) || !fs.statSync(source).isDirectory()) {
    throw new Error("Required public directory is missing: " + relativePath);
  }
  fs.cpSync(source, target, {
    recursive: true,
    filter: sourcePath => {
      const stat = fs.statSync(sourcePath);
      return stat.isDirectory() || [".json", ".svg", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif"].includes(path.extname(sourcePath).toLowerCase());
    }
  });
}

function build() {
  fs.rmSync(output, { recursive: true, force: true });
  fs.mkdirSync(output, { recursive: true });
  for (const file of publicFiles) copyFile(file);
  for (const directory of publicDirectories) copyPublicDirectory(directory);
  fs.writeFileSync(path.join(output, ".nojekyll"), "");

  const required = [
    "index.html",
    "store/index.html",
    "privacy.html",
    "terms.html",
    "app-ads.txt",
    "jobs-feed.json",
    "version.json",
    "regional-catalog/search_index_light.json"
  ];
  for (const file of required) {
    if (!fs.existsSync(path.join(output, file))) {
      throw new Error("Static output is missing " + file);
    }
  }

  process.stdout.write(JSON.stringify({
    outputDirectory: "dist",
    publicFiles: publicFiles.length,
    publicDirectories,
    includesPwa: true,
    includesLandingPage: true,
    includesPrivacyAndTerms: true,
    includesNationalSearchIndex: true
  }, null, 2) + "\n");
}

build();
