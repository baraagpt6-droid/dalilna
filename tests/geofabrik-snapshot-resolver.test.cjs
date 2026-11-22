const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const { test } = require("node:test");

const resolver = path.join(__dirname, "..", "scripts", "resolve_geofabrik_snapshot.py");

test("Geofabrik fallback selects the newest dated Yemen PBF and ignores latest/checksum links", () => {
  const html = `
    <a href="yemen-261119.osm.pbf">older snapshot</a>
    <a href="yemen-latest.osm.pbf">latest extract</a>
    <a href="yemen-261121.osm.pbf.md5">checksum</a>
    <a href="https://download.geofabrik.de/asia/yemen-261120.osm.pbf">middle snapshot</a>
    <a href="yemen-261121.osm.pbf">newest snapshot</a>
  `;
  const result = spawnSync("python3", [resolver], { input: html, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "yemen-261121.osm.pbf");
});

test("Geofabrik fallback fails closed when the index has no dated Yemen PBF", () => {
  const result = spawnSync("python3", [resolver], {
    input: '<a href="yemen-latest.osm.pbf">latest</a>',
    encoding: "utf8",
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /No dated Yemen PBF snapshot links found/);
});
