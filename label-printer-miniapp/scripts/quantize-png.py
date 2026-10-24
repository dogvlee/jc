"""Shrink committed PNGs without changing how they look.

The label thumbnails are screenshots of black-on-white layouts: 640x480 RGBA
with soft edges.  They were 676 KB together, which the 2 MiB main package
cannot spare.  A 64-colour palette keeps them pixel-indistinguishable (worst
RMSE 2.6/255) at 28% of the size.

    python scripts/quantize-png.py miniprogram/assets/shangyue-thumbs
    python scripts/quantize-png.py file.png --colors 96

Files that would grow are left alone, so running it twice is harmless.
Pillow is only needed when refreshing the assets.
"""

from __future__ import annotations

import argparse
import io
from pathlib import Path

from PIL import Image


def quantize(path: Path, colors: int) -> tuple[int, int]:
    original = path.read_bytes()
    with Image.open(io.BytesIO(original)) as opened:
        source = opened.convert("RGBA")
        palette = source.quantize(colors=colors, method=Image.FASTOCTREE)
        buffer = io.BytesIO()
        palette.save(buffer, "PNG", optimize=True, compress_level=9)
    optimized = buffer.getvalue()
    if len(optimized) >= len(original):
        return len(original), len(original)
    path.write_bytes(optimized)
    return len(original), len(optimized)


def png_files(target: Path) -> list[Path]:
    if target.is_dir():
        return sorted(target.glob("*.png"))
    return [target]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("targets", nargs="+", type=Path)
    parser.add_argument("--colors", type=int, default=64)
    args = parser.parse_args()

    files = [file for target in args.targets for file in png_files(target) if file.is_file()]
    before = after = 0
    for file in files:
        old_size, new_size = quantize(file, args.colors)
        before += old_size
        after += new_size
    saved = before - after
    print(f"quantized {len(files)} files: {before} -> {after} bytes ({saved} saved)")


if __name__ == "__main__":
    main()
