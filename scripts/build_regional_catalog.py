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


def classify(tags):
    shop = str(tags.get("shop") or "").lower()
    amenity = str(tags.get("amenity") or "").lower()
    healthcare = str(tags.get("healthcare") or "").lower()
    tourism = str(tags.get("tourism") or "").lower()
    office = str(tags.get("office") or "").lower()
    craft = str(tags.get("craft") or "").lower()
    leisure = str(tags.get("leisure") or "").lower()
    transport = str(tags.get("public_transport") or "").lower()
    landuse = str(tags.get("landuse") or "").lower()

    if amenity == "marketplace":
        return "market"
    if shop in {"supermarket", "convenience", "grocery", "general", "greengrocer", "butcher"}:
        return "grocery"
    if amenity in {"restaurant", "fast_food", "food_court"} or shop == "bakery":
        return "food"
    if amenity == "cafe":
        return "cafe"
    if shop in {"books", "stationery"} or amenity == "library":
        return "books"
    if shop in {"pharmacy", "chemist"} or amenity == "pharmacy" or healthcare == "pharmacy":
        return "pharmacy"
    if amenity in {"hospital", "clinic", "doctors", "dentist"} or healthcare in {"hospital", "clinic", "doctor", "dentist"}:
        return "health"
    if amenity in {"school", "college", "university", "kindergarten"}:
        return "edu"
    if office in {"government", "administrative"}:
        return "gov"
    if office == "estate_agent" or shop == "estate_agent":
        return "real_estate"
    if shop in {"jewelry", "jewellery"}:
        return "gold"
    if amenity in {"bank", "atm", "bureau_de_change"}:
        return "money"
    if amenity == "place_of_worship" or tags.get("building") == "mosque":
        return "mosque"
    if tourism in {"hotel", "guest_house", "hostel", "motel", "apartment", "camp_site"}:
        return "hotel"
    if shop in {"car", "motorcycle", "car_repair", "car_parts", "tyres", "vehicle"}:
        return "vehicles"
    if shop == "watches" or craft == "watchmaker":
        return "watches"
    if shop in {"clothes", "shoes", "tailor"}:
        return "clothes"
    if shop in {"furniture", "houseware", "appliance"}:
        return "home"
    if shop in {"beauty", "cosmetics", "perfumery"}:
        return "beauty"
    if shop == "hairdresser":
        return "salon"
    if shop == "mobile_phone":
        return "telecom"
    if shop in {"electronics", "electrical", "computer"}:
        return "elec"
    if shop == "building_materials" or shop == "hardware":
        return "build"
    if craft:
        return "craft"
    if amenity in {"bus_station", "taxi", "fuel"} or transport in {"station", "stop_position", "platform"} or tags.get("railway") == "station":
        return "transport"
    if amenity == "post_office" or shop in {"parcel", "travel_agency"}:
        return "delivery"
    if shop in {"gas", "propane"}:
        return "utility"
    if amenity == "events_venue" or leisure == "amusement_arcade":
        return "wedding"
    if shop in {"agrarian", "garden_centre", "farm"} or landuse == "farmyard":
        return "farm"
    if tags.get("emergency") in {"fire_station", "ambulance_station"}:
        return "health"
    return None


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
    gov_names, district_names = {}, {}
    for gov in governors:
        for value in (gov["name"], gov["nameLocal"], gov["nameEn"]):
            if value:
                gov_names[normalize(value)] = gov["name"]
    for district in districts:
        for value in (district["name"], district["nameLocal"], district["nameEn"]):
            if value:
                district_names[normalize(value)] = (district["governorate"], district["name"])
    output = []
    for feature in features:
        tags = tags_of(feature)
        if tags.get("boundary") != "administrative":
            continue
        level = str(tags.get("admin_level") or "")
        candidates = (tags.get("name:ar"), tags.get("name"), tags.get("name:en"), tags.get("official_name"))
        target, kind = None, None
        for name in candidates:
            key = normalize(name)
            if not key:
                continue
            if level in {"6", "7"} and key in district_names:
                gov, district = district_names[key]
                target, kind = {"governorate": gov, "district": district}, "district"
                break
            if level in {"4", "5"} and key in gov_names:
                target, kind = {"governorate": gov_names[key], "district": ""}, "governorate"
                break
        geometry = feature.get("geometry") or {}
        if not target or geometry.get("type") not in {"Polygon", "MultiPolygon"}:
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
        bbox = (min(p[0] for p in points), min(p[1] for p in points),
                max(p[0] for p in points), max(p[1] for p in points))
        output.append({"target": target, "geometry": geometry, "bbox": bbox})
    return output


def assign_region(lat, lon, governors, districts, boundaries):
    for boundary in boundaries:
        west, south, east, north = boundary["bbox"]
        if west <= lon <= east and south <= lat <= north and point_in_geometry(lon, lat, boundary["geometry"]):
            target = boundary["target"]
            return target["governorate"], target["district"], "osm-boundary"
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
    for feature in features:
        tags = tags_of(feature)
        category = classify(tags)
        if not category:
            continue
        name = clean(tags.get("name:ar") or tags.get("name") or tags.get("brand") or tags.get("operator"), 160)
        point = geometry_point(feature.get("geometry"))
        if not name or not point:
            continue
        lat, lon = point
        governorate, district, quality = assign_region(lat, lon, governors, districts, boundaries)
        if not governorate:
            continue
        raw_id = str(feature.get("id") or tags.get("@id") or tags.get("osm_id") or "")
        object_type = str(tags.get("@type") or tags.get("osm_type") or "node").lower()
        if "/" in raw_id:
            object_type, raw_id = raw_id.split("/", 1)
        if not raw_id:
            raw_id = f"coord-{lat:.6f}-{lon:.6f}"
        item_id = "osm-" + re.sub(r"[^a-zA-Z0-9_-]", "-", object_type + "-" + raw_id)
        key = (normalize(name), round(lat, 4), round(lon, 4))
        if key in seen:
            continue
        seen.add(key)
        addr = [tags.get("addr:full"), tags.get("addr:street"), tags.get("addr:suburb"),
                tags.get("addr:neighbourhood"), tags.get("addr:city"), tags.get("addr:district")]
        address = clean("، ".join(clean(v, 70) for v in addr if clean(v)), 240)
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
        output.append({
            "id": item_id, "name": name, "category": category,
            "governorate": governorate, "district": district, "address": address,
            "phone": phone, "website": website, "openingHours": opening,
            "description": description, "lat": round(lat, 6), "lon": round(lon, 6),
            "mapsUrl": maps, "sourceUrl": source_url, "source": "OpenStreetMap",
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
        counts = Counter(item["category"] for item in rows)
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
        if item.get("assignmentQuality") == "osm-boundary":
            bucket["boundaryCount"] += 1
        else:
            bucket["approximateCount"] += 1
        category = clean(item.get("category"), 40)
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
    manifest = {"schemaVersion": 1, "snapshotDate": snapshot, "totalCount": len(items),
                "districtCountSchemaVersion": 1,
                "districtCountTotal": sum(row["count"] for row in district_manifest),
                "districtCounts": district_manifest,
                "source": "OpenStreetMap contributors", "license": "ODbL-1.0",
                "attribution": "© OpenStreetMap contributors",
                "administrativeSource": "Open Admin Data Yemen (CC BY 4.0)",
                "assignmentNote": "District counts include boundary matches and centroid estimates. boundaryCount is matched to an OSM administrative polygon; approximateCount uses the nearest district centroid and must be treated as an estimate.",
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
