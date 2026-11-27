#!/usr/bin/env python3
"""Offline validation of Play Store icon and feature-graphic render outputs."""

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from prepare_google_play_assets import render_svg


ROOT = Path(__file__).resolve().parents[1]


class PlayAssetTests(unittest.TestCase):
    def test_icon_dimensions_alpha_and_limit(self):
        with tempfile.TemporaryDirectory() as temp:
            output = Path(temp) / "icon.png"
            render_svg(ROOT / "icons" / "icon.svg", output, (512, 512), "RGBA")
            from PIL import Image
            with Image.open(output) as image:
                self.assertEqual(image.size, (512, 512))
                self.assertEqual(image.mode, "RGBA")
            self.assertLess(output.stat().st_size, 1_000_000)

    def test_feature_graphic_dimensions_and_rgb(self):
        with tempfile.TemporaryDirectory() as temp:
            output = Path(temp) / "feature-graphic.png"
            render_svg(ROOT / "store-assets" / "feature-graphic.svg",
                       output, (1024, 500), "RGB")
            from PIL import Image
            with Image.open(output) as image:
                self.assertEqual(image.size, (1024, 500))
                self.assertEqual(image.mode, "RGB")


if __name__ == "__main__":
    unittest.main()
