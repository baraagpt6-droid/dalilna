#!/usr/bin/env python3
"""Fuse OSM, Overture Places and optional FSQ Open Places exports for Yemen.

Every output feature retains source identifiers and per-source license metadata.
OSM-derived records remain identifiable as ODbL data; this script does not
re-license mixed-source records as one homogeneous database.
"""
from __future__ import annotations
import argparse, json, math, os, re, sys
from collections import defaultdict
from difflib import SequenceMatcher
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen

import build_regional_catalog as builder

ARABIC = re.compile(r"[\u0600-\u06ff]")
CELL = 0.00035
MAX_DISTANCE_M = 50.0

OVERTURE_LICENSES = {
    "foursquare": "Apache-2.0",
    "meta": "CDLA-Permissive-2.0",
    "microsoft": "CDLA-Permissive-2.0",
    "pinmeto": "CDLA-Permissive-2.0",
    "krick": "CDLA-Permissive-2.0",
    "renderseo": "CDLA-Permissive-2.0",
    "dac": "CDLA-Permissive-2.0",
    "brightquery": "CDLA-Permissive-2.0",
    "birdeye": "CDLA-Permissive-2.0",
    "uberall": "CDLA-Permissive-2.0",
    "alltheplaces": "CC0-1.0",
    "opentravel": "CDLA-Permissive-2.0",
    "birdeye": "CDLA-Permissive-2.0",
    "dac": "CDLA-Permissive-2.0",
    "pinmeto": "CDLA-Permissive-2.0",
    "renderseo": "CDLA-Permissive-2.0",
    "uberall": "CDLA-Permissive-2.0",
}
FSQ_LICENSE = "Apache-2.0"
OSM_LICENSE = "ODbL-1.0"

# Overture Basic Categories / taxonomy labels and FSQ category names/IDs
# are normalized into Dalilna's shared Arabic category dictionary.
CATEGORY_HINTS = [
    (("hospital", "clinic", "medical center", "medical centre", "healthcare", "doctor", "dentist", "urgent care", "مستشفى", "عيادة", "مركز صحي"), "health"),
    (("pharmacy", "drugstore", "chemist", "صيدلية"), "pharmacy"),
    (("school", "university", "college", "kindergarten", "education", "مدرسة", "جامعة", "روضة"), "edu"),
    (("mosque", "place of worship", "religious organization", "مسجد", "جامع"), "mosque"),
    (("grocery", "supermarket", "convenience store", "food market", "بقالة", "سوبرماركت"), "grocery"),
    (("restaurant", "fast food", "food court", "مطعم"), "food"),
    (("cafe", "coffee shop", "tea house", "مقهى", "كافيه"), "cafe"),
    (("bank", "atm", "money transfer", "currency exchange", "صراف", "بنك"), "money"),
    (("gas station", "fuel", "petrol station", "محطة وقود"), "fuel"),
    (("car repair", "auto repair", "vehicle repair", "car dealer", "motorcycle dealer", "قطع غيار", "سيارات"), "vehicles"),
    (("mobile phone", "cell phone", "telecommunication", "electronics store", "computer store", "جوال", "إلكترونيات"), "telecom"),
    (("clothing store", "shoe store", "clothing", "ملابس", "أحذية"), "clothes"),
    (("furniture store", "home goods", "hardware store", "building material", "أثاث", "مواد بناء"), "home"),
    (("hotel", "motel", "hostel", "guest house", "فندق"), "hotel"),
    (("courier", "post office", "delivery", "parcel", "شحن", "توصيل"), "delivery"),
    (("government office", "municipal office", "public service", "حكومي", "بلدية"), "gov"),
    (("hair salon", "beauty salon", "barber", "صالون", "حلاقة"), "beauty"),
    (("park", "tourist attraction", "museum", "landmark", "حديقة", "متحف"), "tourism"),
    (("solar", "solar energy", "renewable energy", "طاقة شمسية"), "solar"),
    (("farm", "agriculture", "agricultural", "livestock", "مزرعة", "زراعة", "مواشي"), "farm"),
]
CATEGORY_TO_TAG = {
    "grocery": ("shop", "supermarket"), "food": ("amenity", "restaurant"),
    "cafe": ("amenity", "cafe"), "edu": ("amenity", "school"),
    "health": ("amenity", "clinic"), "pharmacy": ("amenity", "pharmacy"),
    "mosque": ("amenity", "place_of_worship"), "money": ("amenity", "bank"),
    "fuel": ("amenity", "fuel"), "vehicles": ("shop", "car"),
    "telecom": ("shop", "mobile_phone"), "elec": ("shop", "electronics"),
    "clothes": ("shop", "clothes"), "home": ("shop", "furniture"),
    "hotel": ("tourism", "hotel"), "delivery": ("office", "courier"),
    "gov": ("office", "government"), "beauty": ("shop", "beauty"),
    "tourism": ("tourism", "attraction"), "solar": ("shop", "solar"),
    "farm": ("landuse", "farmyard"),
}

def norm(value):
    return builder.normalize(value)

def text(value, limit=300):
    if value is None: return ""
    if isinstance(value, (list, tuple)): value = " ".join(str(x) for x in value if x)
    if isinstance(value, dict): value = value.get("name") or value.get("primary") or value.get("value") or ""
    return builder.clean(value, limit)

def first_value(values):
    for value in values:
        value = text(value)
        if value: return value
    return ""

def point_of(feature, props, source):
    geom = feature.get("geometry") or {}
    point = builder.geometry_point(geom)
    if point: return point
    lat = props.get("latitude", props.get("lat"))
    lon = props.get("longitude", props.get("lon", props.get("lng")))
    try:
        lat, lon = float(lat), float(lon)
    except (TypeError, ValueError):
        return None
    if -90 <= lat <= 90 and -180 <= lon <= 180: return lat, lon
    return None

def extract_category_values(props, tags, source):
    values = []
    if source == "overture":
        values.extend([props.get("basic_category")])
        taxonomy = props.get("taxonomy") or {}
        if isinstance(taxonomy, dict):
            values.extend([taxonomy.get("primary")])
            values.extend(taxonomy.get("hierarchy") or [])
            values.extend(taxonomy.get("alternates") or [])
    elif source == "fsq":
        for field in ("categories", "category", "category_name", "category_label", "fsq_category_names", "fsq_category_labels"):
            value = props.get(field)
            if isinstance(value, list):
                for entry in value:
                    values.append(entry.get("name") if isinstance(entry, dict) else entry)
            elif value:
                values.append(value)
    values.extend([tags.get("amenity"), tags.get("shop"), tags.get("healthcare"), tags.get("office"),
                   tags.get("tourism"), tags.get("craft"), tags.get("service")])
    return [text(value, 120) for value in values if text(value, 120)]

def category_for_values(values, mapping):
    """Resolve external taxonomy labels to one exact primary category.

    Overture/FSQ labels often contain taxonomy paths (for example
    'Health and Beauty > Pharmacies'). Compare normalized leaf labels and
    explicit provider labels only; never use loose substring matching.
    """
    candidates = []
    for raw in values:
        value = norm(raw)
        if not value:
            continue
        candidates.append(value)
        for part in re.split(r"[>/|]", str(raw or "")):
            part = norm(part)
            if part:
                candidates.append(part)
        for part in re.split(r"[._:]+", value):
            part = norm(part)
            if part:
                candidates.append(part)
    candidates = list(dict.fromkeys(candidates))
    categories = mapping.get("categories", {})
    found = []
    external_hints = mapping.get("externalCategoryHints") or {}
    for category, definition in categories.items():
        if category not in categories:
            continue
        aliases = [definition.get("labelAr"), definition.get("labelEn"), *(definition.get("aliases") or [])]
        exact_aliases = {norm(item) for item in aliases if norm(item)}
        exact_hints = {norm(item) for item in external_hints.get(category, []) if norm(item)}
        if any(candidate in exact_aliases or candidate in exact_hints for candidate in candidates):
            found.append(category)
    if not found and not external_hints:
        for candidate in candidates:
            for hints, category in CATEGORY_HINTS:
                normalized_hints = {norm(hint) for hint in hints if norm(hint)}
                if candidate in normalized_hints and category in categories:
                    found.append(category)
    if not found and candidates and "other" in categories:
        found.append("other")
    order = mapping.get("externalPrimaryOrder") or mapping.get("primaryCategoryOrder") or list(categories)
    ranks = {key: index for index, key in enumerate(order)}
    primary = sorted(set(found), key=lambda key: ranks.get(key, 999))
    return primary[:1]

def source_metadata(props, source, source_id):
    if source == "osm":
        return [{"name": "OpenStreetMap", "id": source_id, "license": OSM_LICENSE,
                 "url": ("https://www.openstreetmap.org/" + source_id) if source_id else "https://www.openstreetmap.org/copyright"}]
    if source == "fsq":
        return [{"name": "Foursquare Open Places", "id": source_id, "license": FSQ_LICENSE,
                 "url": "https://foursquare.com/placemakers/review-place/" + source_id if source_id else "https://docs.foursquare.com/data-products/docs/fsq-places-open-source"}]
    sources = props.get("sources") or []
    result = []
    for item in sources:
        if not isinstance(item, dict): continue
        dataset = text(item.get("dataset") or item.get("provider") or "Overture Maps", 80).lower()
        license_name = text(item.get("license") or OVERTURE_LICENSES.get(dataset, "license-unresolved"), 80)
        result.append({"name": "Overture Maps", "dataset": dataset,
                       "id": text(item.get("record_id") or props.get("id"), 120),
                       "license": license_name, "confidence": item.get("confidence"),
                       "url": "https://docs.overturemaps.org/guides/places/"})
    if not result:
        dataset = "overture"
        result.append({"name": "Overture Maps", "dataset": dataset,
                       "id": text(props.get("id"), 120),
                       "license": "license-unresolved",
                       "confidence": props.get("confidence")})
    return result

def as_feature(feature, source, mapping):
    props = feature.get("properties") or {}
    tags = props.get("tags") if isinstance(props.get("tags"), dict) else {}
    if props.get("operating_status") == "permanently_closed" or (props.get("confidence") is not None and float(props.get("confidence") or 0) <= 0):
        return None
    if props.get("date_closed") or props.get("date_closed_utc"):
        return None
    flags = props.get("unresolved_flags") or []
    if isinstance(flags, str): flags = [flags]
    blocked_flags = {"closed", "duplicate", "delete", "privatevenue", "inappropriate", "doesnt_exist"}
    if blocked_flags.intersection(str(flag).strip().lower() for flag in flags):
        return None
    country = str(props.get("country") or "").strip().upper()
    if source == "fsq" and country and country != "YE":
        return None
    point = point_of(feature, props, source)
    if not point: return None
    lat, lon = point
    if not (11.0 <= lat <= 20.5 and 41.0 <= lon <= 55.5):
        return None

    if source == "osm":
        clone = dict(feature)
        clone["properties"] = dict(props)
        clone["properties"]["__sources"] = source_metadata(props, "osm", text(feature.get("id") or tags.get("@id")))
        clone["properties"]["__source"] = "OpenStreetMap"
        return clone

    names = props.get("names") if isinstance(props.get("names"), dict) else {}
    primary = first_value([props.get("name"), props.get("name_primary"), names.get("primary"), props.get("fsq_name")])
    common = names.get("common") or props.get("alt_names") or props.get("aliases") or []
    if isinstance(common, dict): common = list(common.values())
    if not isinstance(common, list): common = [common]
    all_names = [primary] + [text(x, 160) for x in common if text(x, 160)]
    arabic_name = first_value([x for x in all_names if ARABIC.search(str(x or ""))])
    english_name = first_value([x for x in all_names if x and not ARABIC.search(str(x))])
    if not primary and not arabic_name and not english_name: return None

    addresses = props.get("addresses") or []
    if isinstance(addresses, dict): addresses = [addresses]
    address = ""
    if addresses and isinstance(addresses[0], dict):
        a = addresses[0]
        address = first_value([a.get("freeform"), a.get("formatted_address"),
            ", ".join(str(x) for x in (a.get("locality"), a.get("region"), a.get("country")) if x)])
    if not address:
        address = first_value([props.get("address"), props.get("formatted_address"), props.get("location", {}).get("formatted_address") if isinstance(props.get("location"), dict) else ""])
    phones = props.get("phones") or props.get("tel") or props.get("phone") or []
    if not isinstance(phones, list): phones = [phones]
    websites = props.get("websites") or props.get("website") or props.get("url") or []
    if not isinstance(websites, list): websites = [websites]
    phone, website = first_value(phones), first_value(websites)

    values = extract_category_values(props, tags, source)
    # Explicit OSM activity tags outrank broad external taxonomy labels.
    strict = []
    for rule in mapping.get("strictPrimaryRules", []):
        if builder._matches_rule(tags, rule) and rule.get("category") in mapping.get("categories", {}):
            strict = [rule["category"]]
            break
    categories = strict or category_for_values(values, mapping)
    normalized_tags = dict(tags)
    normalized_tags["name"] = arabic_name or primary or english_name
    if arabic_name: normalized_tags["name:ar"] = arabic_name
    if english_name: normalized_tags["name:en"] = english_name
    if address: normalized_tags["addr:full"] = address
    if phone: normalized_tags["phone"] = phone
    if website: normalized_tags["website"] = website
    if props.get("operating_status") == "permanently_closed":
        normalized_tags["__permanently_closed"] = "yes"
    normalized_tags["__catalog_categories"] = categories
    if values: normalized_tags["__source_categories"] = " | ".join(values[:12])

    if source == "overture":
        raw_id = text(props.get("id") or feature.get("id"), 120)
        source_list = source_metadata(props, source, raw_id)
        source_name, src_id = "Overture Maps", raw_id
    else:
        raw_id = text(props.get("fsq_place_id") or props.get("fsq_id") or props.get("id") or feature.get("id"), 120)
        source_list = source_metadata(props, source, raw_id)
        source_name, src_id = "Foursquare Open Places", raw_id

    normalized = {
        "type": "Feature",
        "id": source_name.lower().replace(" ", "-") + "/" + (src_id or f"{lat:.6f}-{lon:.6f}"),
        "geometry": {"type": "Point", "coordinates": [lon, lat]},
        "properties": {
            "tags": normalized_tags,
            "__sources": source_list,
            "__source": source_name,
            "__confidence": props.get("confidence"),
            "__operating_status": props.get("operating_status"),
            "__source_categories": values,
        }
    }
    return normalized

def name_keys(feature):
    tags = builder.tags_of(feature)
    values = [tags.get("name:ar"), tags.get("name:en"), tags.get("name"), tags.get("alt_name"),
              tags.get("official_name"), tags.get("brand"), tags.get("operator")]
    return {norm(value) for value in values if norm(value)}

def haversine_m(a, b):
    lat1, lon1 = a; lat2, lon2 = b
    radius = 6371008.8
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2-lat1), math.radians(lon2-lon1)
    h = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2*radius*math.asin(math.sqrt(min(1, h)))

def merge_tags(target, incoming):
    for key, value in incoming.items():
        if value in (None, "", [], {}): continue
        if key in ("__catalog_categories",):
            merged = list(target.get(key) or [])
            for item in (value if isinstance(value, list) else [value]):
                if item not in merged: merged.append(item)
            target[key] = merged
        elif key in ("__source_categories",):
            left = str(target.get(key) or "")
            target[key] = " | ".join(dict.fromkeys([x for x in [left, str(value)] if x]))
        elif not target.get(key) or (key == "name:en" and not ARABIC.search(str(value))):
            target[key] = value

def merge_feature(target, incoming):
    left, right = target.setdefault("properties", {}), incoming.get("properties") or {}
    left_tags = left.setdefault("tags", {})
    merge_tags(left_tags, right.get("tags") or {})
    for key in ("__sources",):
        values = left.setdefault(key, [])
        for source in right.get(key) or []:
            signature = (source.get("name"), source.get("dataset"), source.get("id"))
            if not any((x.get("name"), x.get("dataset"), x.get("id")) == signature for x in values):
                values.append(source)
    incoming_confidence = right.get("__confidence")
    current_confidence = left.get("__confidence")
    try:
        incoming_score = float(incoming_confidence) if incoming_confidence is not None else None
        current_score = float(current_confidence) if current_confidence is not None else None
    except (TypeError, ValueError):
        incoming_score = current_score = None
    if incoming_score is not None and (current_score is None or incoming_score > current_score):
        left["__confidence"] = incoming_confidence
        incoming_geometry = incoming.get("geometry")
        if incoming_geometry:
            target["geometry"] = incoming_geometry
    if right.get("__operating_status") and not left.get("__operating_status"):
        left["__operating_status"] = right["__operating_status"]
    # Provider merges can combine several taxonomy labels. Re-resolve after
    # merging all source tags so a pharmacy or car workshop remains in one
    # primary directory section.
    primary_categories = builder.categories_for_tags(left_tags)
    if primary_categories:
        left_tags["__catalog_categories"] = primary_categories

def similar_name_keys(keys_a, keys_b):
    if not keys_a or not keys_b: return False
    if keys_a & keys_b: return True
    return any(SequenceMatcher(None, x, y).ratio() >= 0.92
               for x in keys_a for y in keys_b if len(x) >= 5 and len(y) >= 5)

def similar_names(a, b):
    return similar_name_keys(name_keys(a), name_keys(b))

def cell_key(lat, lon):
    # Yemen longitudes are near cos(lat)=0.96; square buckets avoid polar distortion.
    return math.floor(lat/CELL), math.floor(lon/CELL)

def deduplicate(features):
    buckets, merged, points, keys_cache = defaultdict(list), [], [], []
    stats = {"input": len(features), "unique": 0, "duplicatesMerged": 0}
    for feature in features:
        point = builder.geometry_point(feature.get("geometry"))
        if not point: continue
        incoming_keys = name_keys(feature)
        lat, lon = point; row, col = cell_key(lat, lon)
        matched = None
        if incoming_keys:
            for dr in (-2, -1, 0, 1, 2):
                for dc in (-2, -1, 0, 1, 2):
                    for index in buckets[(row+dr, col+dc)]:
                        other = points[index]
                        if other and haversine_m(point, other) < MAX_DISTANCE_M and similar_name_keys(keys_cache[index], incoming_keys):
                            matched = index
                            break
                    if matched is not None: break
                if matched is not None: break
        if matched is None:
            index = len(merged)
            merged.append(feature); points.append(point); keys_cache.append(incoming_keys)
            buckets[(row, col)].append(index)
        else:
            merge_feature(merged[matched], feature)
            points[matched] = builder.geometry_point(merged[matched].get("geometry")) or points[matched]
            keys_cache[matched] = name_keys(merged[matched])
            stats["duplicatesMerged"] += 1
    stats["unique"] = len(merged)
    return merged, stats

_COUNTRY_SHAPE_CACHE = {}

def country_contains(feature, geometries):
    point = builder.geometry_point(feature.get("geometry"))
    if not point:
        return False
    lon, lat = point[1], point[0]
    try:
        from shapely.geometry import Point, shape
        from shapely.prepared import prep
    except ImportError:
        return any(builder.point_in_geometry(lon, lat, geometry) for geometry in geometries)
    candidate = Point(lon, lat)
    for geometry in geometries:
        key = id(geometry)
        prepared = _COUNTRY_SHAPE_CACHE.get(key)
        if prepared is None:
            polygon = shape(geometry)
            prepared = prep(polygon)
            _COUNTRY_SHAPE_CACHE[key] = prepared
        if prepared.intersects(candidate):
            return True
    return False


def read_geojson(path):
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    if isinstance(payload, dict) and payload.get("type") == "FeatureCollection":
        return payload.get("features") or []
    if isinstance(payload, list): return payload
    raise ValueError(f"Unsupported GeoJSON format: {path}")

def download_fsq(url, token, output):
    parsed = urlparse(url)
    if parsed.scheme != "https:" or not parsed.hostname:
        raise ValueError("FSQ export URL must be HTTPS.")
    request = Request(url, headers={"Accept": "application/geo+json, application/json"})
    if token: request.add_header("Authorization", "Bearer " + token)
    with urlopen(request, timeout=120) as response, open(output, "wb") as target:
        length = 0
        while True:
            chunk = response.read(1024*1024)
            if not chunk: break
            length += len(chunk)
            if length > 2_000_000_000: raise ValueError("FSQ export exceeds 2 GB.")
            target.write(chunk)

def load_fsq_category_names(path):
    if not path or not Path(path).exists(): return {}
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    rows = payload.get("categories", payload) if isinstance(payload, dict) else payload
    output = {}
    for row in rows if isinstance(rows, list) else []:
        if not isinstance(row, dict): continue
        cid = text(row.get("category_id") or row.get("fsq_category_id") or row.get("id"), 100)
        name = text(row.get("name") or row.get("category_name") or row.get("label"), 160)
        if cid and name: output[cid] = name
    return output

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--osm", required=True)
    parser.add_argument("--overture", required=True)
    parser.add_argument("--fsq", default="")
    parser.add_argument("--fsq-url", default="")
    parser.add_argument("--fsq-categories", default="")
    parser.add_argument("--fsq-categories-url", default="")
    parser.add_argument("--country-boundary", default="")
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    mapping = builder.load_category_mapping()
    fsq_category_names = load_fsq_category_names(args.fsq_categories)
    country_geometries = []
    if args.country_boundary:
        boundary_payload = json.loads(Path(args.country_boundary).read_text(encoding="utf-8"))
        boundary_features = boundary_payload.get("features", []) if isinstance(boundary_payload, dict) else []
        country_geometries = [feature.get("geometry") for feature in boundary_features if feature.get("geometry")]
        if not country_geometries:
            raise ValueError("Yemen country boundary file does not contain polygon features.")
    groups = [
        ("osm", read_geojson(args.osm)),
        ("overture", read_geojson(args.overture)),
    ]
    if args.fsq_url:
        temp = Path("fsq-yemen-download.geojson")
        download_fsq(args.fsq_url, os.environ.get("FSQ_OS_PLACES_ACCESS_TOKEN", ""), temp)
        args.fsq = str(temp)
    if args.fsq_categories_url:
        categories_temp = Path("fsq-categories-download.json")
        download_fsq(args.fsq_categories_url, os.environ.get("FSQ_OS_PLACES_ACCESS_TOKEN", ""), categories_temp)
        args.fsq_categories = str(categories_temp)
    if args.fsq and Path(args.fsq).exists() and Path(args.fsq).stat().st_size:
        groups.append(("fsq", read_geojson(args.fsq)))
    elif args.fsq:
        print("FSQ export path was configured but empty; refusing to treat it as a successful FSQ import.", file=sys.stderr)
        raise SystemExit(2)

    normalized, source_counts = [], {}
    source_counts["osmInput"] = len(groups[0][1])
    source_counts["overtureInput"] = len(groups[1][1])
    source_counts["fsqInput"] = len(groups[2][1]) if len(groups) > 2 else 0
    for source, features in groups:
        accepted = 0
        for feature in features:
            if source == "fsq" and fsq_category_names:
                props = feature.setdefault("properties", {})
                ids = props.get("fsq_category_ids") or props.get("category_ids") or []
                props["fsq_category_names"] = [fsq_category_names[x] for x in ids if x in fsq_category_names]
            item = as_feature(feature, source, mapping)
            if item and country_geometries:
                point = builder.geometry_point(item.get("geometry"))
                if not country_contains(item, country_geometries):
                    item = None
            if item:
                if source == "overture":
                    props = feature.get("properties") or {}
                    datasets = [text(x.get("dataset"), 40).lower() for x in props.get("sources") or [] if isinstance(x, dict)]
                    if "foursquare" in datasets: source_counts["foursquareInsideOverture"] = source_counts.get("foursquareInsideOverture", 0)+1
                normalized.append(item); accepted += 1
        source_counts[source+"Accepted"] = accepted

    fused, dedup = deduplicate(normalized)
    output = {"type": "FeatureCollection", "metadata": {
        "schemaVersion": 1, "generatedAt": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
        "sources": source_counts, "deduplication": dedup, "dedupeRadiusMeters": MAX_DISTANCE_M,
        "licenses": {"OpenStreetMap": OSM_LICENSE, "Overture Maps": "CDLA-Permissive-2.0 / source-specific upstream licenses", "Foursquare Open Places": FSQ_LICENSE},
        "fsqStandaloneConfigured": bool(args.fsq or args.fsq_url),
    }, "features": fused}
    Path(args.output).write_text(json.dumps(output, ensure_ascii=False, separators=(",", ":"))+"\n", encoding="utf-8")
    print(json.dumps(output["metadata"], ensure_ascii=False))
    if not source_counts["overtureAccepted"]:
        raise SystemExit("No valid Overture Places records were imported; refusing to publish an OSM-only v2.6 catalogue.")

if __name__ == "__main__":
    main()
