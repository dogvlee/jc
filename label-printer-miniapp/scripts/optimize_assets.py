"""Build Mini Program-safe monochrome assets from niim-label-app sources.

The source application ships full-colour preview material. Label printers and
the editor ultimately use a 1-bit raster, so the Mini Program keeps a compact,
deterministic monochrome copy. The generated files are committed; Pillow is
only needed when deliberately refreshing them.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


ASSET_GROUPS = {
    "online-images": 512,
    "online-thumbs": 320,
    "materials": 256,
}


def convert(source: Path, destination: Path, max_dimension: int) -> None:
    with Image.open(source) as opened:
        rgba = opened.convert("RGBA")
        white = Image.new("RGBA", rgba.size, "white")
        white.alpha_composite(rgba)
        grayscale = white.convert("L")
        grayscale.thumbnail(
            (max_dimension, max_dimension), Image.Resampling.LANCZOS
        )
        monochrome = grayscale.point(
            lambda value: 255 if value >= 180 else 0, mode="1"
        )
        destination.parent.mkdir(parents=True, exist_ok=True)
        monochrome.save(destination.with_suffix(".png"), "PNG", optimize=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--workspace",
        type=Path,
        default=Path(__file__).resolve().parents[2],
        help="Workspace containing niim-label-app and label-printer-miniapp",
    )
    args = parser.parse_args()

    workspace = args.workspace.resolve()
    source_root = workspace / "niim-label-app" / "public" / "assets"
    output_root = (
        workspace / "label-printer-miniapp" / "miniprogram" / "assets"
    )

    converted = 0
    output_bytes = 0
    for group, max_dimension in ASSET_GROUPS.items():
        source_group = source_root / group
        if not source_group.exists():
            continue
        for source in sorted(path for path in source_group.rglob("*") if path.is_file()):
            relative = source.relative_to(source_group).with_suffix(".png")
            destination = output_root / group / relative
            convert(source, destination, max_dimension)
            converted += 1
            output_bytes += destination.stat().st_size

    print(f"optimized {converted} assets ({output_bytes} bytes)")


if __name__ == "__main__":
    main()
