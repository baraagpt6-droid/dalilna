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
    def test_builds_a_compressed_yemen_index_with_eight_fields_per_record(self):
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
                (catalog / filename).write_text(json.dumps({"items": [item]}, ensure_ascii=False), encoding="utf-8")
            (catalog / "manifest.json").write_text(
                json.dumps({"totalCount": 22, "governorates": governors}, ensure_ascii=False),
                encoding="utf-8"
            )
            output = root / "search_index_light.json"
            subprocess.run([
                sys.executable, "scripts/build_search_index_light.py",
                "--catalog-dir", str(catalog), "--output", str(output)
            ], check=True, capture_output=True, text=True)
            envelope = json.loads(output.read_text(encoding="utf-8"))
            self.assertLessEqual(output.stat().st_size, 1_500_000)
            self.assertEqual(envelope["recordCount"], 22)
            self.assertEqual(envelope["encoding"], "gzip+base64")
            payload = json.loads(gzip.decompress(base64.b64decode(envelope["data"])).decode("utf-8"))
            self.assertEqual(len(payload["i"]), 22)
            self.assertTrue(all(len(row) == 8 for row in payload["i"]))
            self.assertEqual(payload["c"], ["craft"])
            self.assertEqual(payload["g"], [row["name"] for row in governors])
            self.assertNotIn("openingHours", payload)
            self.assertNotIn("address", payload)

if __name__ == "__main__":
    unittest.main()
