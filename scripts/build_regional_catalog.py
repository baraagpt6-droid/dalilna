#!/usr/bin/env python3
"""Build a per-governorate Yemen POI catalogue from OpenStreetMap.

OpenStreetMap-derived data is distributed under ODbL-1.0. Administrative
names and district-centre coordinates come from Open Admin Data (CC BY 4.0).
"""
from __future__ import annotations
import argparse
import json
import math
import re
import unicodedata
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path


def normalize(value):
    text = unicodedata.normalize("NFKC", str(value or "")).lower()
    text = re.sub(r"[\u064B-\u065F\u0670\u0640]", "", text)
    text = text.translate(str.maketrans({
        "أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا",
        "ة": "ه", "ى": "ي", "ؤ": "و", "ئ": "ي",
    }))
    text = re.sub(r"[^a-z0-9\u0600-\u06FF]+", " ", text)
    return " ".join(text.split())


def read_json(path):
    with Path(path).open("r", encoding="utf-8") as handle:
        return json.load(handle)


def geojson_features(path):
    if not path or not Path(path).exists():
        return []
    payload = read_json(path)
    return payload.get("features", []) if isinstance(payload, dict) else []


def tags_of(feature):
    props = feature.get("properties") or {}
    tags = props.get("tags")
    return tags if isinstance(tags, dict) else props


def geometry_point(geometry):
    if not isinstance(geometry, dict):
        return None
    if geometry.get("type") == "Point":
        coords = geometry.get("coordinates") or []
        if len(coords) >= 2:
            lon, lat = float(coords[0]), float(coords[1])
            if -180 <= lon <= 180 and -90 <= lat <= 90:
                return lat, lon
        return None
    values = []
    def walk(node):
        if isinstance(node, (list, tuple)):
            if len(node) >= 2 and isinstance(node[0], (int, float)) and isinstance(node[1], (int, float)):
                lon, lat = float(node[0]), float(node[1])
                if -180 <= lon <= 180 and -90 <= lat <= 90:
                    values.append((lon, lat))
            else:
                for child in node:
                    walk(child)
    walk(geometry.get("coordinates") or [])
    if not values:
        return None
    lons = [p[0] for p in values]
    lats = [p[1] for p in values]
    return (min(lats) + max(lats)) / 2, (min(lons) + max(lons)) / 2


def point_in_ring(lon, lat, ring):
    inside = False
    if len(ring) < 3:
        return False
    previous = ring[-1]
    for current in ring:
        x1, y1 = float(previous[0]), float(previous[1])
        x2, y2 = float(current[0]), float(current[1])
        if (y1 > lat) != (y2 > lat):
            cross = (x2 - x1) * (lat - y1) / ((y2 - y1) or 1e-15) + x1
            if lon < cross:
                inside = not inside
        previous = current
    return inside


def point_in_geometry(lon, lat, geometry):
    if not isinstance(geometry, dict):
        return False
    kind, coordinates = geometry.get("type"), geometry.get("coordinates") or []
    polygons = [coordinates] if kind == "Polygon" else coordinates if kind == "MultiPolygon" else []
    for polygon in polygons:
        if not polygon or not point_in_ring(lon, lat, polygon[0]):
            continue
        if any(point_in_ring(lon, lat, hole) for hole in polygon[1:]):
            continue
        return True
    return False


def distance_km(lat1, lon1, lat2, lon2):
    radius = 6371.0088
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dlat, dlon = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlon / 2) ** 2
    return 2 * radius * math.asin(math.sqrt(min(1.0, a)))


def load_category_mapping(path=None):
    mapping_path = Path(path) if path else Path(__file__).with_name("category-mapping.json")
    data = read_json(mapping_path)
    categories = data.get("categories") if isinstance(data, dict) else None
    if not isinstance(categories, dict) or not categories:
        raise ValueError("category-mapping.json is missing its categories dictionary")
    return data


CATEGORY_MAPPING = load_category_mapping()


def _matches_rule(tags, rule):
    key = str(rule.get("key") or "")
    value = str(tags.get(key) or "").strip().lower()
    expected = str(rule.get("value") or "").strip().lower()
    return bool(value) and (expected == "*" or value == expected)


def categories_for_tags(tags, mapping=None):
    mapping = mapping or CATEGORY_MAPPING
    definitions = mapping.get("categories", {})
    matched = []
    for category, definition in definitions.items():
        for rule in definition.get("osmTags", []):
            if _matches_rule(tags, rule):
                matched.append(category)
                break

    for rule in mapping.get("multiCategoryRules", []):
        if not _matches_rule(tags, rule):
            continue
        condition = rule.get("when")
        if condition and str(tags.get(condition.get("key")) or "").strip().lower() != str(condition.get("value") or "").strip().lower():
            continue
        for category in rule.get("categories", []):
            if category in definitions and category not in matched:
                matched.append(category)

    # Retain named shops and public amenities even when OSM introduces a
    # previously unseen value. They appear under "other" and remain searchable.
    if not matched and (str(tags.get("shop") or "").strip() or str(tags.get("amenity") or "").strip()):
        if "other" in definitions:
            matched.append("other")

    order = mapping.get("primaryCategoryOrder") or list(definitions)
    rank = {category: index for index, category in enumerate(order)}
    return sorted(set(matched), key=lambda category: rank.get(category, len(rank)))


def classify(tags):
    matched = categories_for_tags(tags)
    return matched[0] if matched else None


def load_admin(governorate_file, district_file, regions_file):
    governors_raw = read_json(governorate_file)
    if isinstance(governors_raw, dict):
        governors_raw = governors_raw.get("data", [])
    districts_raw = read_json(district_file)
    if isinstance(districts_raw, dict):
        districts_raw = districts_raw.get("data", [])
    source = Path(regions_file).read_text(encoding="utf-8")
    match = re.search(r"window\.DALILNA_YEMEN_DISTRICTS\s*=\s*(\{.*?\});", source, re.S)
    if not match:
        raise ValueError("Could not read Yemen district names from regions-yemen.js")
    app_districts = json.loads(match.group(1))
    app_governorates = list(app_districts.keys())
    gov_by_id, governors = {}, []

    for record in governors_raw:
        names = record.get("name") or {}
        local, english = names.get("local", ""), names.get("en", "")
        normalized = {normalize(local), normalize(english)}
        display = next((name for name in app_governorates if normalize(name) in normalized), None)
        if not display:
            continue
        geo = record.get("geo") or {}
        lat, lon = float(geo.get("lat") or 0), float(geo.get("lon") or 0)
        gov_by_id[str(record.get("id"))] = display
        governors.append({"id": str(record.get("id")), "name": display, "nameLocal": local,
                          "nameEn": english, "lat": lat, "lon": lon,
                          "slug": names.get("slug") or str(record.get("id")).lower()})

    districts = []
    for record in districts_raw:
        parent = record.get("parent") or {}
        governorate = gov_by_id.get(str(parent.get("id")))
        if not governorate:
            continue
        names = record.get("name") or {}
        local, english = names.get("local", ""), names.get("en", "")
        display = next((name for name in app_districts.get(governorate, []) if normalize(name) == normalize(local)), local)
        geo = record.get("geo") or {}
        try:
            lat, lon = float(geo["lat"]), float(geo["lon"])
        except (KeyError, TypeError, ValueError):
            continue
        if -90 <= lat <= 90 and -180 <= lon <= 180:
            districts.append({"id": str(record.get("id")), "governorate": governorate,
                              "name": display, "nameLocal": local, "nameEn": english,
                              "lat": lat, "lon": lon})
    if len(governors) != 22 or len(districts) != 335:
        raise ValueError(f"Administrative source incomplete: {len(governors)} governorates, {len(districts)} districts")
    return governors, districts


def prepare_boundaries(features, governors, districts):
    gov_names = {}
    district_names = defaultdict(list)
    for gov in governors:
        for value in (gov["name"], gov["nameLocal"], gov["nameEn"]):
            if value:
                gov_names[normalize(value)] = gov["name"]
    for district in districts:
        for value in (district["name"], district["nameLocal"], district["nameEn"]):
            if value:
                key = normalize(value)
                candidate = (district["governorate"], district["name"])
                if candidate not in district_names[key]:
                    district_names[key].append(candidate)

    output = []
    for feature in features:
        tags = tags_of(feature)
        props = feature.get("properties") or {}
        geometry = feature.get("geometry") or {}
        if geometry.get("type") not in {"Polygon", "MultiPolygon"}:
            continue

        # Native OSM relations use boundary=administrative/admin_level.
        # geoBoundaries GeoJSON uses shapeName/shapeType and carries explicit
        # source/license metadata. Support both so we no longer depend on
        # Yemen's incomplete OSM district boundary coverage.
        is_osm = tags.get("boundary") == "administrative"
        level = str(tags.get("admin_level") or props.get("shapeType") or "").upper()
        candidates = (
            tags.get("name:ar"), tags.get("name:en"), tags.get("name"),
            tags.get("official_name"), props.get("shapeName"),
            props.get("shapeNameLocal"), props.get("shapeNameEn")
        )
        target = None
        source = "OpenStreetMap"
        license_name = "ODbL-1.0"
        quality = "osm-boundary"

        for name in candidates:
            key = normalize(name)
            if not key:
                continue
            if (level in {"6", "7", "ADM2", "ADM3"} or not is_osm) and key in district_names:
                matches = district_names[key]
                if len(matches) == 1:
                    governorate, district = matches[0]
                else:
                    # Same district name may exist in more than one governorate.
                    # Resolve duplicate names using distance to the published
                    # Open Admin Data district centre, not a name-only guess.
                    centre = geometry_point(geometry)
                    if centre:
                        lat, lon = centre
                        selected = min(
                            (item for item in districts if (item["governorate"], item["name"]) in matches),
                            key=lambda item: distance_km(lat, lon, item["lat"], item["lon"])
                        )
                        governorate, district = selected["governorate"], selected["name"]
                    else:
                        continue
                target = {"governorate": governorate, "district": district}
                if props.get("shapeName"):
                    source = "geoBoundaries"
                    license_name = clean(props.get("boundaryLicense") or props.get("license") or "CC BY 3.0 IGO", 120)
                    quality = "geoboundaries-polygon"
                break
            if (level in {"4", "5", "ADM1"} or not is_osm) and key in gov_names:
                target = {"governorate": gov_names[key], "district": ""}
                if props.get("shapeName"):
                    source = "geoBoundaries"
                    license_name = clean(props.get("boundaryLicense") or props.get("license") or "CC BY 3.0 IGO", 120)
                    quality = "geoboundaries-governorate-polygon"
                break

        if not target:
            continue
        coords = geometry.get("coordinates") or []
        points = []
        def walk(node):
            if isinstance(node, (list, tuple)):
                if len(node) >= 2 and isinstance(node[0], (int, float)) and isinstance(node[1], (int, float)):
                    points.append((float(node[0]), float(node[1])))
                else:
                    for child in node:
                        walk(child)
        walk(coords)
        if not points:
            continue
        bbox = (min(point[0] for point in points), min(point[1] for point in points),
                max(point[0] for point in points), max(point[1] for point in points))
        output.append({
            "target": target,
            "geometry": geometry,
            "bbox": bbox,
            "quality": quality,
            "source": source,
            "license": license_name,
            "sourceId": clean(props.get("shapeID") or tags.get("id") or feature.get("id"), 120)
        })
    # More specific district polygons are checked before governorate polygons.
    return sorted(output, key=lambda item: 0 if item["target"].get("district") else 1)

def assign_region(lat, lon, governors, districts, boundaries):
    matched_governorate = None
    for boundary in boundaries:
        west, south, east, north = boundary["bbox"]
        if west <= lon <= east and south <= lat <= north and point_in_geometry(lon, lat, boundary["geometry"]):
            target = boundary["target"]
            # A district polygon is more specific than a governorate polygon.
            # Do not stop at a governorate boundary when no district polygon matched.
            if target.get("district"):
                return target["governorate"], target["district"], boundary.get("quality", "osm-boundary")
            matched_governorate = target.get("governorate") or matched_governorate

    if matched_governorate:
        local_districts = [d for d in districts if d["governorate"] == matched_governorate]
        if local_districts:
            nearest = min(local_districts, key=lambda d: distance_km(lat, lon, d["lat"], d["lon"]))
            distance = distance_km(lat, lon, nearest["lat"], nearest["lon"])
            if distance <= 70:
                return matched_governorate, nearest["name"], "approximate-district-centroid"
        return matched_governorate, "", "approximate-governorate-centroid"

    nearest = min(districts, key=lambda d: distance_km(lat, lon, d["lat"], d["lon"]))
    distance = distance_km(lat, lon, nearest["lat"], nearest["lon"])
    if distance <= 70:
        return nearest["governorate"], nearest["name"], "approximate-district-centroid"
    gov = min(governors, key=lambda g: distance_km(lat, lon, g["lat"], g["lon"]))
    return gov["name"], "", "approximate-governorate-centroid"


def clean(value, limit=220):
    return re.sub(r"\s+", " ", str(value or "")).strip()[:limit]


def build_items(features, governors, districts, boundaries):
    output, seen = [], set()
    district_lookup = {
        (normalize(item["governorate"]), normalize(item["name"])): item
        for item in districts
    }
    governor_lookup = {normalize(item["name"]): item for item in governors}
    search_keys = CATEGORY_MAPPING.get("osmSearchKeys", [])

    for feature in features:
        tags = tags_of(feature)
        categories = categories_for_tags(tags)
        if not categories:
            continue
        primary_category = categories[0]
        name_ar = clean(tags.get("name:ar") or tags.get("name") or tags.get("brand") or tags.get("operator"), 160)
        name_en = clean(tags.get("name:en") or tags.get("int_name") or tags.get("official_name:en") or "", 160)
        if not name_ar:
            name_ar = name_en
        point = geometry_point(feature.get("geometry"))
        if not name_ar or not point:
            continue

        lat, lon = point
        governorate, district, quality = assign_region(lat, lon, governors, districts, boundaries)
        if not governorate:
            continue
        gov_info = governor_lookup.get(normalize(governorate), {})
        dist_info = district_lookup.get((normalize(governorate), normalize(district)), {})

        raw_id = str(feature.get("id") or tags.get("@id") or tags.get("osm_id") or "")
        object_type = str(tags.get("@type") or tags.get("osm_type") or "node").lower()
        if "/" in raw_id:
            object_type, raw_id = raw_id.split("/", 1)
        if not raw_id:
            raw_id = f"coord-{lat:.6f}-{lon:.6f}"
        item_id = "osm-" + re.sub(r"[^a-zA-Z0-9_-]", "-", object_type + "-" + raw_id)
        key = (normalize(name_ar), normalize(name_en), round(lat, 4), round(lon, 4))
        if key in seen:
            continue
        seen.add(key)

        addr = [
            tags.get("addr:full"), tags.get("addr:street"), tags.get("addr:suburb"),
            tags.get("addr:neighbourhood"), tags.get("addr:city"), tags.get("addr:district")
        ]
        address = clean("، ".join(clean(v, 70) for v in addr if clean(v)), 240)
        neighbourhood = clean(tags.get("addr:neighbourhood") or tags.get("addr:suburb") or tags.get("addr:quarter") or "", 120)
        street = clean(tags.get("addr:street") or "", 120)
        phone = clean(tags.get("contact:phone") or tags.get("phone") or tags.get("telephone") or tags.get("mobile"), 60)
        website = clean(tags.get("contact:website") or tags.get("website") or tags.get("url"), 320)
        if website and not re.match(r"^https?://", website, re.I):
            website = "https://" + website
        if website and not re.match(r"^https?://[^/]+\.[^/]+", website, re.I):
            website = ""
        opening = clean(tags.get("opening_hours") or tags.get("service_times"), 120)
        description = clean(tags.get("description:ar") or tags.get("description") or tags.get("note"), 280)
        maps = f"https://www.openstreetmap.org/?mlat={lat:.6f}&mlon={lon:.6f}#map=18/{lat:.6f}/{lon:.6f}"

        source_id = str(feature.get("id") or tags.get("@id") or "")
        source_type = "node"
        if "/" in source_id:
            source_type, source_number = source_id.split("/", 1)
        else:
            source_number = source_id
            source_type = object_type
        source_url = (f"https://www.openstreetmap.org/{source_type}/{source_number}"
                      if source_number.isdigit() and source_type in {"node", "way", "relation"} else maps)

        osm_tags = {
            key: clean(tags.get(key), 80).lower()
            for key in search_keys if clean(tags.get(key), 80)
        }
        searchable_values = [
            name_ar, name_en, tags.get("alt_name"), tags.get("official_name"),
            tags.get("brand"), tags.get("operator"), description, address, neighbourhood, street,
            governorate, gov_info.get("nameEn"), district, dist_info.get("nameEn"),
            " ".join(str(tags.get(key) or "") for key in search_keys)
        ]
        search_text = clean(" ".join(str(value) for value in searchable_values if value), 1600)

        output.append({
            "id": item_id,
            "name": name_ar,
            "nameEn": name_en,
            "altNames": clean(" | ".join(
                clean(tags.get(key), 120) for key in ("alt_name", "official_name", "short_name", "brand")
                if clean(tags.get(key), 120)
            ), 500),
            "category": primary_category,
            "categories": categories,
            "osmTags": osm_tags,
            "searchText": search_text,
            "activity": clean(" ".join(str(tags.get(key) or "") for key in ("shop", "amenity", "healthcare", "office", "craft", "tourism", "service", "delivery", "courier") if tags.get(key)), 240),
            "governorate": governorate,
            "governorateEn": clean(gov_info.get("nameEn"), 100),
            "district": district,
            "districtEn": clean(dist_info.get("nameEn"), 100),
            "neighbourhood": neighbourhood,
            "street": street,
            "address": address,
            "phone": phone,
            "website": website,
            "openingHours": opening,
            "description": description,
            "lat": round(lat, 6),
            "lon": round(lon, 6),
            "mapsUrl": maps,
            "sourceUrl": source_url,
            "source": "OpenStreetMap",
            "assignmentQuality": quality
        })
    return output


def write_catalog(items, governors, districts, output):
    if not items:
        raise ValueError("No named places extracted. Refusing to replace the public catalogue with an empty dataset.")
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    grouped = defaultdict(list)
    for item in items:
        grouped[item["governorate"]].append(item)
    snapshot = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    manifest_rows = []
    for gov in governors:
        rows = grouped.get(gov["name"], [])
        rows.sort(key=lambda item: (item["district"], item["category"], normalize(item["name"])))
        counts = Counter(category for item in rows for category in item.get("categories", [item["category"]]))
        filename = gov["slug"] + ".json"
        payload = {"schemaVersion": 1, "governorate": gov["name"], "snapshotDate": snapshot,
                   "source": "OpenStreetMap contributors", "license": "ODbL-1.0",
                   "attribution": "© OpenStreetMap contributors",
                   "administrativeSource": "Open Admin Data Yemen (CC BY 4.0)", "items": rows}
        (output / filename).write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
        manifest_rows.append({"name": gov["name"], "slug": gov["slug"], "file": filename,
                              "count": len(rows), "categories": dict(counts)})
    district_buckets = {
        (district["governorate"], district["name"]): {
            "count": 0, "boundaryCount": 0, "approximateCount": 0, "categories": Counter()
        }
        for district in districts
    }
    for item in items:
        district_name = clean(item.get("district"))
        governorate = clean(item.get("governorate"))
        if not district_name:
            continue
        bucket = district_buckets.get((governorate, district_name))
        if bucket is None:
            continue
        bucket["count"] += 1
        if item.get("assignmentQuality") in {"osm-boundary", "geoboundaries-polygon"}:
            bucket["boundaryCount"] += 1
        else:
            bucket["approximateCount"] += 1
        for category in item.get("categories", [item.get("category")]):
            category = clean(category, 40)
            if category:
                bucket["categories"][category] += 1

    district_manifest = [
        {
            "governorate": governorate,
            "district": district_name,
            "count": bucket["count"],
            "boundaryCount": bucket["boundaryCount"],
            "approximateCount": bucket["approximateCount"],
            "categories": dict(bucket["categories"])
        }
        for (governorate, district_name), bucket in district_buckets.items()
    ]
    district_count_total = sum(row["count"] for row in district_manifest)
    manifest = {"schemaVersion": 1, "snapshotDate": snapshot, "totalCount": len(items),
                "districtCountSchemaVersion": 1,
                "districtCountTotal": district_count_total,
                "unassignedCount": max(0, len(items) - district_count_total),
                "districtCounts": district_manifest,
                "source": "OpenStreetMap contributors", "license": "ODbL-1.0",
                "attribution": "© OpenStreetMap contributors",
                "administrativeSource": "Open Admin Data Yemen (CC BY 4.0)",
                "assignmentNote": "District counts include polygon matches (OSM administrative boundaries or geoBoundaries Yemen ADM2) and explicitly marked nearest-centroid estimates. Use boundaryCount for polygon-derived assignments and approximateCount for estimates.",
                "boundarySources": [
                    {"name": "geoBoundaries Yemen ADM2", "level": "ADM2", "source": "Central Statistical Organization (CSO), OCHA Yemen", "license": "CC BY 3.0 IGO", "url": "https://www.geoboundaries.org/api/current/gbOpen/YEM/ADM2/"},
                    {"name": "OpenStreetMap administrative boundaries", "license": "ODbL-1.0", "url": "https://www.openstreetmap.org/copyright"}
                ],
                "governorates": manifest_rows}
    (output / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    return manifest


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--places", type=Path, required=True)
    parser.add_argument("--boundaries", type=Path)
    parser.add_argument("--governorates", type=Path, required=True)
    parser.add_argument("--districts", type=Path, required=True)
    parser.add_argument("--regions", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    governors, districts = load_admin(args.governorates, args.districts, args.regions)
    boundaries = prepare_boundaries(geojson_features(args.boundaries), governors, districts)
    items = build_items(geojson_features(args.places), governors, districts, boundaries)
    manifest = write_catalog(items, governors, districts, args.output)
    print(json.dumps({
        "snapshotDate": manifest["snapshotDate"], "totalCount": manifest["totalCount"],
        "governorates": len(manifest["governorates"]),
        "withPlaces": sum(1 for row in manifest["governorates"] if row["count"]),
        "boundaryAssignments": sum(1 for item in items if item["assignmentQuality"] == "osm-boundary"),
        "approximateAssignments": sum(1 for item in items if item["assignmentQuality"] != "osm-boundary")
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
