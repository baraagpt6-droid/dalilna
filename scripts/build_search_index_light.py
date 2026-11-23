#!/usr/bin/env python3
"""Build a small, compressed, full-Yemen search index from the regional catalogues.

The decompressed logical records contain only:
id, name, category, gov, district, phone, lat, lng and opening hours.

The on-disk JSON is a gzip/base64 envelope with dictionary-coded repeated values.
This keeps all 22 governorates in one download while preserving the exact fields.
"""
from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
import json
from pathlib import Path


MAX_BYTES = 1_500_000
SCALE = 100_000


def compact_id(value: str) -> str:
    return hashlib.blake2s(value.encode("utf-8"), digest_size=9).hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog-dir", default="regional-catalog")
    parser.add_argument("--output", default="regional-catalog/search_index_light.json")
    args = parser.parse_args()

    catalog_dir = Path(args.catalog_dir)
    manifest = json.loads((catalog_dir / "manifest.json").read_text(encoding="utf-8"))
    governorates = manifest.get("governorates") or []
    if len(governorates) != 22:
        raise SystemExit(f"Expected 22 governorates, got {len(governorates)}")

    gov_names = [str(row.get("name") or "").strip() for row in governorates]
    gov_index = {name: i for i, name in enumerate(gov_names)}
    categories: list[str] = []
    districts: list[list[object]] = []
    district_index: dict[tuple[str, int], int] = {}
    rows: list[list[object]] = []
    seen_ids: set[str] = set()
    identity_occurrences: dict[str, int] = {}

    for region in governorates:
        gov = str(region.get("name") or "").strip()
        filename = str(region.get("file") or "").strip()
        if not gov or gov not in gov_index or not filename:
            raise SystemExit("Invalid governorate entry in regional manifest")
        payload = json.loads((catalog_dir / filename).read_text(encoding="utf-8"))
        items = payload.get("items") or []
        if not isinstance(items, list):
            raise SystemExit(f"{filename} has no items array")

        for item in items:
            if not isinstance(item, dict):
                continue
            name = str(item.get("name") or "").strip()
            if not name:
                continue
            category = str(item.get("category") or "other").strip() or "other"
            row_gov = str(item.get("governorate") or gov).strip() or gov
            row_district = str(item.get("district") or "").strip()
            if row_gov not in gov_index:
                row_gov = gov
            gidx = gov_index[row_gov]
            cidx = len(categories)
            if category in categories:
                cidx = categories.index(category)
            else:
                categories.append(category)
            district_key = (row_district, gidx)
            didx = district_index.get(district_key)
            if didx is None:
                didx = len(districts)
                district_index[district_key] = didx
                districts.append([row_district, gidx])

            def coordinate(key: str) -> int | None:
                try:
                    value = float(item.get(key))
                    if not (-180 <= value <= 180):
                        return None
                    return int(round(value * SCALE))
                except (TypeError, ValueError):
                    return None

            lat = coordinate("lat")
            lng = coordinate("lon")
            phone = str(item.get("phone") or "").strip()
            opening_hours = str(item.get("openingHours") or item.get("opening_hours") or item.get("hours") or "").strip()[:120]
            source_id = str(item.get("id") or "").strip()
            if not source_id:
                source_id = "|".join([
                    name, category, row_gov, row_district,
                    str(item.get("lat") or ""), str(item.get("lon") or "")
                ])
            # OSM coordinate-based IDs can legitimately appear in more than one
            # governorate file after boundary/centroid assignment. Qualify the
            # compact key with the displayed record fields so those entries do
            # not abort the national build. Stable duplicate ordinals preserve
            # deterministic IDs for exact repeated records.
            identity = "|".join([
                source_id, row_gov, row_district, name, category,
                str(lat), str(lng), phone
            ])
            duplicate_number = identity_occurrences.get(identity, 0)
            identity_occurrences[identity] = duplicate_number + 1
            compact = compact_id(identity if duplicate_number == 0 else identity + "|duplicate:" + str(duplicate_number))
            while compact in seen_ids:
                duplicate_number += 1
                compact = compact_id(identity + "|duplicate:" + str(duplicate_number))
            seen_ids.add(compact)
            rows.append([
                compact, name, cidx, gidx, didx, phone, lat, lng, opening_hours
            ])

    rows.sort(key=lambda row: (row[3], row[2], row[1].casefold(), row[0]))
    logical_payload = {
        "v": 2,
        "c": categories,
        "g": gov_names,
        "d": districts,
        "i": rows,
    }
    raw = json.dumps(logical_payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    compressed = gzip.compress(raw, compresslevel=9, mtime=0)
    envelope = {
        "schemaVersion": 2,
        "encoding": "gzip+base64",
        "recordCount": len(rows),
        "rawBytes": len(raw),
        "data": base64.b64encode(compressed).decode("ascii"),
    }
    encoded = (json.dumps(envelope, separators=(",", ":")) + "\n").encode("utf-8")
    if len(rows) != int(manifest.get("totalCount") or -1):
        raise SystemExit(
            f"Search index count mismatch: built {len(rows)}, manifest says {manifest.get('totalCount')}"
        )
    if not rows:
        raise SystemExit("Refusing to write an empty Yemen search index")
    if len(encoded) > MAX_BYTES:
        raise SystemExit(
            f"Compressed search index is {len(encoded):,} bytes; limit is {MAX_BYTES:,}"
        )

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(encoded)
    print(json.dumps({
        "output": str(output),
        "records": len(rows),
        "governorates": len(gov_names),
        "bytes": len(encoded),
        "rawBytes": len(raw),
        "gzipBytes": len(compressed),
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
