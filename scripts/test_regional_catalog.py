#!/usr/bin/env python3
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_regional_catalog as catalog


class RegionalCatalogTests(unittest.TestCase):
    def test_normalizes_arabic_search_names(self):
        self.assertEqual(catalog.normalize("أَبْرَاء"), "ابراء")
        self.assertEqual(catalog.normalize("بقالة"), catalog.normalize("بقاله"))

    def test_classifies_service_and_market_tags(self):
        self.assertEqual(catalog.classify({"shop": "convenience"}), "grocery")
        self.assertEqual(catalog.classify({"amenity": "pharmacy"}), "pharmacy")
        self.assertEqual(catalog.classify({"amenity": "school"}), "edu")
        self.assertEqual(catalog.classify({"shop": "mobile_phone"}), "telecom")
        self.assertEqual(catalog.classify({"shop": "car"}), "vehicles")
        self.assertIsNone(catalog.classify({"amenity": "bench"}))

    def test_centres_polygon_and_linestring_geometry(self):
        self.assertEqual(catalog.geometry_point({"type": "Point", "coordinates": [44.0, 15.0]}), (15.0, 44.0))
        polygon = {"type": "Polygon", "coordinates": [[[44, 15], [46, 15], [46, 17], [44, 17], [44, 15]]]}
        self.assertEqual(catalog.geometry_point(polygon), (16.0, 45.0))

    def test_polygon_membership_and_holes(self):
        polygon = {"type": "Polygon", "coordinates": [
            [[43, 13], [45, 13], [45, 15], [43, 15], [43, 13]],
            [[43.5, 13.5], [44.5, 13.5], [44.5, 14.5], [43.5, 14.5], [43.5, 13.5]]
        ]}
        self.assertTrue(catalog.point_in_geometry(43.2, 13.2, polygon))
        self.assertFalse(catalog.point_in_geometry(44.0, 14.0, polygon))

    def test_builds_named_openstreetmap_records_and_deduplicates(self):
        gov = [{"name": "إب", "lat": 14.0, "lon": 44.0}]
        districts = [{"governorate": "إب", "name": "حبيش", "lat": 14.0, "lon": 44.0}]
        feature = {"type": "Feature", "id": "node/123", "geometry": {"type": "Point", "coordinates": [44, 14]},
                   "properties": {"name:ar": "بقالة الاختبار", "shop": "convenience", "phone": "777123456"}}
        rows = catalog.build_items([feature, feature], gov, districts, [])
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["governorate"], "إب")
        self.assertEqual(rows[0]["district"], "حبيش")
        self.assertEqual(rows[0]["phone"], "777123456")
        self.assertEqual(rows[0]["sourceUrl"], "https://www.openstreetmap.org/node/123")

    def test_nearest_centroid_assignments_are_explicitly_approximate(self):
        gov = [{"name": "إب", "lat": 14, "lon": 44}]
        districts = [{"governorate": "إب", "name": "حبيش", "lat": 14, "lon": 44}]
        self.assertEqual(catalog.assign_region(14, 44, gov, districts, []),
                         ("إب", "حبيش", "approximate-district-centroid"))


    def test_mapping_dictionary_covers_english_osm_tags_and_multicategory_health(self):
        self.assertEqual(set(catalog.categories_for_tags({"amenity": "hospital"})), {"health"})
        self.assertEqual(set(catalog.categories_for_tags({"amenity": "clinic"})), {"health"})
        self.assertEqual(set(catalog.categories_for_tags({"amenity": "doctors"})), {"health"})
        self.assertEqual(set(catalog.categories_for_tags({"amenity": "pharmacy"})), {"health", "pharmacy"})
        self.assertIn("delivery", catalog.categories_for_tags({"office": "courier"}))
        self.assertIn("delivery", catalog.categories_for_tags({"shop": "parcel"}))
        self.assertIn("vehicles", catalog.categories_for_tags({"shop": "car"}))
        self.assertIn("elec", catalog.categories_for_tags({"shop": "electronics"}))
        self.assertIn("solar", catalog.categories_for_tags({"shop": "solar"}))

    def test_geoboundaries_adm2_polygon_matches_english_district_name(self):
        governors = [{"name": "إب", "nameEn": "Ibb", "nameLocal": "اب", "lat": 13.9, "lon": 44.1}]
        districts = [{"governorate": "إب", "name": "الظهار", "nameEn": "Adh Dhihar",
                      "lat": 13.976, "lon": 44.161, "nameLocal": "الظهار"}]
        feature = {"type": "Feature", "properties": {"shapeName": "Adh Dhihar", "shapeType": "ADM2"},
                   "geometry": {"type": "Polygon", "coordinates": [[[44.0, 13.8], [44.3, 13.8],
                     [44.3, 14.1], [44.0, 14.1], [44.0, 13.8]]]}}
        boundaries = catalog.prepare_boundaries([feature], governors, districts)
        self.assertEqual(len(boundaries), 1)
        self.assertEqual(boundaries[0]["target"]["district"], "الظهار")
        self.assertEqual(boundaries[0]["quality"], "geoboundaries-polygon")
        self.assertEqual(catalog.assign_region(13.9, 44.1, governors, districts, boundaries),
                         ("إب", "الظهار", "geoboundaries-polygon"))

    def test_records_include_all_matched_categories_and_bilingual_search_text(self):
        gov = [{"name": "إب", "nameEn": "Ibb", "lat": 14, "lon": 44}]
        districts = [{"governorate": "إب", "name": "حبيش", "nameEn": "Hubaysh", "lat": 14, "lon": 44}]
        feature = {"type": "Feature", "id": "node/234", "geometry": {"type": "Point", "coordinates": [44, 14]},
                   "properties": {"name:ar": "صيدلية الاختبار", "name:en": "Test Pharmacy", "amenity": "pharmacy"}}
        rows = catalog.build_items([feature], gov, districts, [])
        self.assertEqual(set(rows[0]["categories"]), {"health", "pharmacy"})
        self.assertEqual(rows[0]["nameEn"], "Test Pharmacy")
        self.assertIn("pharmacy", rows[0]["searchText"].lower())
        self.assertIn("صيدليات", rows[0]["searchText"])
    def test_category_mapping_loads_from_repository_root_and_contains_core_tags(self):
        mapping = catalog.load_category_mapping()
        self.assertIn("health", mapping["categories"])
        self.assertIn("delivery", mapping["categories"])
        self.assertIn("real_estate", mapping["categories"])
        self.assertIn({"key": "amenity", "value": "hospital"},
                      mapping["categories"]["health"]["osmTags"])
        self.assertIn({"key": "office", "value": "courier"},
                      mapping["categories"]["delivery"]["osmTags"])

    def test_classifies_markets_jewellery_and_rail_stations(self):
        self.assertEqual(catalog.classify({"amenity": "marketplace"}), "market")
        self.assertEqual(catalog.classify({"shop": "jewelry"}), "gold")
        self.assertEqual(catalog.classify({"railway": "station"}), "transport")


if __name__ == "__main__":
    unittest.main(verbosity=2)
