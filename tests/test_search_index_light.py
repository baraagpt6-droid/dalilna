#!/usr/bin/env python3
import base64
import gzip
import json
import subprocess
import sys
import tempfile
from pathlib import Path
import unittest

class SearchIndexGeneratorTests(unittest.TestCase):
    def test_builds_a_compressed_yemen_index_with_nine_fields_per_record(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            catalog = root / "catalog"
            catalog.mkdir()
            governors = []
            for index in range(22):
                name = f"محافظة {index}"
                filename = f"gov-{index}.json"
                governors.append({"name": name, "file": filename, "count": 1})
                item = {
                    "id": f"osm-node-{index}",
                    "name": f"محل اختبار {index}",
                    "category": "craft",
                    "governorate": name,
                    "district": f"مديرية {index}",
                    "phone": "+967777000000",
                    "lat": 15.25 + index / 100,
                    "lon": 44.18 + index / 100,
                    "address": "must not be included",
                    "openingHours": "24/7",
                }
                rows = [item]
                if index == 0:
                    duplicate_source_id = dict(item)
                    duplicate_source_id.update({
                        "name": "فرع إضافي",
                        "district": "مديرية فرعية",
                        "lat": 15.255,
                        "lon": 44.185
                    })
                    rows.append(duplicate_source_id)
                    governors[-1]["count"] = 2
                (catalog / filename).write_text(json.dumps({"items": rows}, ensure_ascii=False), encoding="utf-8")
            (catalog / "manifest.json").write_text(
                json.dumps({"totalCount": 23, "governorates": governors}, ensure_ascii=False),
                encoding="utf-8"
            )
            output = root / "search_index_light.json"
            subprocess.run([
                sys.executable, "scripts/build_search_index_light.py",
                "--catalog-dir", str(catalog), "--output", str(output)
            ], check=True, capture_output=True, text=True)
            envelope = json.loads(output.read_text(encoding="utf-8"))
            self.assertLessEqual(output.stat().st_size, 1_500_000)
            self.assertEqual(envelope["recordCount"], 23)
            self.assertEqual(envelope["encoding"], "gzip+base64")
            payload = json.loads(gzip.decompress(base64.b64decode(envelope["data"])).decode("utf-8"))
            self.assertEqual(len(payload["i"]), 23)
            self.assertTrue(all(len(row) == 9 for row in payload["i"]))
            self.assertEqual(envelope["schemaVersion"], 2)
            self.assertEqual(payload["v"], 2)
            self.assertTrue(all(row[8] == "24/7" for row in payload["i"]))
            self.assertEqual(len({row[0] for row in payload["i"]}), 23)
            self.assertEqual(payload["c"], ["craft"])
            self.assertEqual(payload["g"], [row["name"] for row in governors])
            self.assertNotIn("address", payload)
            self.assertNotIn("address", payload)

if __name__ == "__main__":
    unittest.main()
