#!/usr/bin/env python3
"""Backfill district assignments and district counts in the existing Yemen OSM catalogue.

This script does not download or replace OSM place data. It uses the catalogue's
existing coordinates plus Open Admin Data Yemen district centroids. Records
without an OSM district assignment are assigned to the nearest district in
their own governorate only when the centroid is within 70 km.
"""
from __future__ import annotations

import argparse
import json
import math
import re
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path


def normalize(value: object) -> str:
    text = unicodedata.normalize("NFKC", str(value or "")).lower()
    text = re.sub(r"[\u064b-\u065f\u0670\u0640]", "", text)
    text = text.translate(str.maketrans({
        "أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا",
        "ة": "ه", "ى": "ي", "ؤ": "و", "ئ": "ي",
    }))
    text = re.sub(r"[^a-z0-9\u0600-\u06FF]+", " ", text)
    return " ".join(text.split())


def distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    value = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * radius * math.asin(math.sqrt(value))


def load_json(path: Path):
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: Path, payload: object, pretty: bool = False) -> None:
    with path.open("w", encoding="utf-8", newline="\n") as handle:
        if pretty:
            json.dump(payload, handle, ensure_ascii=False, indent=2)
        else:
            json.dump(payload, handle, ensure_ascii=False, separators=(",", ":"))
        handle.write("\n")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog-dir", type=Path, default=Path("regional-catalog"))
    parser.add_argument("--districts", type=Path, required=True)
    args = parser.parse_args()

    catalog_dir = args.catalog_dir
    manifest_path = catalog_dir / "manifest.json"
    manifest = load_json(manifest_path)
    admin_districts = load_json(args.districts)
    if len(admin_districts) != 335:
        raise SystemExit(f"Expected 335 administrative districts, found {len(admin_districts)}")

    governorates = manifest.get("governorates") or []
    governorate_names = {normalize(row["name"]): row["name"] for row in governorates}
    districts_by_governorate = defaultdict(list)
    district_rows = []
    district_lookup = {}

    for record in admin_districts:
        parent_local = ((record.get("parent") or {}).get("name") or {}).get("local", "")
        governorate = governorate_names.get(normalize(parent_local), parent_local)
        district = ((record.get("name") or {}).get("local") or "").strip()
        geo = record.get("geo") or {}
        lat, lon = float(geo.get("lat") or 0), float(geo.get("lon") or 0)
        if not governorate or not district or not (-90 <= lat <= 90 and -180 <= lon <= 180):
            raise SystemExit(f"Invalid administrative district record: {record.get('id')}")
        row = {
            "governorate": governorate,
            "district": district,
            "count": 0,
            "boundaryCount": 0,
            "approximateCount": 0,
            "categories": Counter(),
            "lat": lat,
            "lon": lon,
        }
        key = normalize(governorate) + "|" + normalize(district)
        if key in district_lookup:
            raise SystemExit(f"Duplicate district key: {governorate} / {district}")
        district_lookup[key] = row
        districts_by_governorate[normalize(governorate)].append(row)
        district_rows.append(row)

    if len(district_rows) != 335:
        raise SystemExit("Administrative district list is incomplete.")

    catalogue_files = sorted(p for p in catalog_dir.glob("*.json") if p.name != "manifest.json")
    if len(catalogue_files) != 22:
        raise SystemExit(f"Expected 22 regional catalogue files, found {len(catalogue_files)}")

    staged_files = {}
    total_count = 0
    unassigned_count = 0
    assigned_by_centroid = 0
    unmatched = []

    for path in catalogue_files:
        payload = load_json(path)
        items = payload.get("items")
        if not isinstance(items, list):
            raise SystemExit(f"Invalid regional catalogue file: {path}")
        changed = False

        for item in items:
            total_count += 1
            governorate = governorate_names.get(normalize(item.get("governorate")), item.get("governorate", ""))
            district = str(item.get("district") or "").strip()

            if not district:
                local_districts = districts_by_governorate.get(normalize(governorate), [])
                try:
                    lat, lon = float(item.get("lat")), float(item.get("lon"))
                except (TypeError, ValueError):
                    lat = lon = None
                if local_districts and lat is not None and lon is not None:
                    nearest = min(
                        local_districts,
                        key=lambda row: distance_km(lat, lon, row["lat"], row["lon"])
                    )
                    distance = distance_km(lat, lon, nearest["lat"], nearest["lon"])
                    if distance <= 70:
                        district = nearest["district"]
                        item["district"] = district
                        item["assignmentQuality"] = "approximate-district-centroid"
                        changed = True
                        assigned_by_centroid += 1

            if not district:
                unassigned_count += 1
                continue

            key = normalize(governorate) + "|" + normalize(district)
            row = district_lookup.get(key)
            if row is None:
                unmatched.append({
                    "file": path.name,
                    "governorate": governorate,
                    "district": district,
                    "item": item.get("name", ""),
                })
                continue

            row["count"] += 1
            if item.get("assignmentQuality") == "osm-boundary":
                row["boundaryCount"] += 1
            else:
                row["approximateCount"] += 1
            category = str(item.get("category") or "").strip()
            if category:
                row["categories"][category] += 1

        if changed:
            staged_files[path] = payload

    if total_count != int(manifest.get("totalCount") or 0):
        raise SystemExit(
            f"Regional item count changed unexpectedly: manifest={manifest.get('totalCount')}, actual={total_count}"
        )
    if unmatched:
        sample = unmatched[:10]
        raise SystemExit(f"{len(unmatched)} catalogue items do not match an official district. Sample: {sample}")

    district_count_total = sum(row["count"] for row in district_rows)
    if district_count_total + unassigned_count != total_count:
        raise SystemExit("District count reconciliation failed.")

    district_manifest = []
    for row in district_rows:
        district_manifest.append({
            "governorate": row["governorate"],
            "district": row["district"],
            "count": row["count"],
            "boundaryCount": row["boundaryCount"],
            "approximateCount": row["approximateCount"],
            "categories": dict(row["categories"]),
        })

    manifest["districtCountSchemaVersion"] = 1
    manifest["districtCountTotal"] = district_count_total
    manifest["unassignedCount"] = unassigned_count
    manifest["districtCounts"] = district_manifest
    manifest["assignmentNote"] = (
        "District counts use OpenStreetMap district polygons when available; otherwise the nearest district "
        "centroid within 70 km. boundaryCount indicates a district polygon match. approximateCount indicates "
        "a centroid estimate. Records outside this range remain governorate-only and are included in unassignedCount."
    )

    # Write only after all 22 catalogues and all 335 district mappings passed validation.
    for path, payload in staged_files.items():
        write_json(path, payload)
    write_json(manifest_path, manifest, pretty=True)

    print(json.dumps({
        "snapshotDate": manifest.get("snapshotDate"),
        "totalCount": total_count,
        "districtCount": len(district_manifest),
        "districtCountTotal": district_count_total,
        "unassignedCount": unassigned_count,
        "newCentroidAssignments": assigned_by_centroid,
        "regionalFilesChanged": len(staged_files),
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
