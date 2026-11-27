#!/usr/bin/env python3
"""Build Play Console graphics from repository sources and the existing screenshot artifact."""

from __future__ import annotations

import argparse
from pathlib import Path
from zipfile import ZipFile

import cairosvg
from PIL import Image


def render_svg(source: Path, target: Path, size: tuple[int, int], mode: str) -> None:
    cairosvg.svg2png(url=str(source), write_to=str(target), output_width=size[0], output_height=size[1])
    with Image.open(target) as image:
        converted = image.convert(mode)
        converted.save(target, format="PNG", optimize=True)
    with Image.open(target) as image:
        if image.size != size or image.mode != mode:
            raise RuntimeError(f"Invalid image {target}: size={image.size}, mode={image.mode}")


def extract_images(source_zip: Path, output_dir: Path) -> None:
    staging = output_dir / "screenshots-unpacked"
    staging.mkdir(parents=True, exist_ok=True)
    with ZipFile(source_zip) as outer:
        nested = [name for name in outer.namelist() if name.lower().endswith(".zip")]
        if len(nested) == 1:
            inner_zip = staging / "inner.zip"
            inner_zip.write_bytes(outer.read(nested[0]))
            with ZipFile(inner_zip) as inner:
                inner.extractall(staging / "inner")
        elif nested:
            raise RuntimeError(f"Expected at most one nested ZIP, found {len(nested)}")
        else:
            outer.extractall(staging / "outer")

    all_png = sorted(staging.rglob("*.png"))
    phone = [p for p in all_png if p.name.lower().startswith("phone-")]
    tablet = [p for p in all_png if p.name.lower().startswith("tablet-")]
    if len(phone) != 4 or len(tablet) != 4:
        raise RuntimeError(f"Expected 4 phone and 4 tablet images, found {len(phone)} and {len(tablet)}")

    for label, paths, folder, expected in (
        ("phone", phone, output_dir / "phone", (1080, 1920)),
        ("tablet", tablet, output_dir / "tablet", (1920, 1080)),
    ):
        folder.mkdir(parents=True, exist_ok=True)
        for index, source in enumerate(paths, start=1):
            with Image.open(source) as image:
                if image.size != expected:
                    raise RuntimeError(f"{source.name} must be {expected}, got {image.size}")
                target = folder / f"{index:02d}-{source.name}"
                image.convert("RGB").save(target, format="PNG", optimize=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--screenshots-zip", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    args = parser.parse_args()

    root = Path(__file__).resolve().parents[1]
    args.output_dir.mkdir(parents=True, exist_ok=True)
    render_svg(root / "icons" / "icon.svg", args.output_dir / "icon.png", (512, 512), "RGBA")
    render_svg(root / "store-assets" / "feature-graphic.svg",
               args.output_dir / "feature-graphic.png", (1024, 500), "RGB")
    if (args.output_dir / "icon.png").stat().st_size > 1_000_000:
        raise RuntimeError("512x512 Play icon exceeds 1 MB")
    extract_images(args.screenshots_zip, args.output_dir)
    print("Prepared 512x512 icon, 1024x500 feature graphic, 4 phone screenshots and 4 tablet screenshots.")


if __name__ == "__main__":
    main()
