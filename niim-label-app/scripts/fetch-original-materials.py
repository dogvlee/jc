#!/usr/bin/env python3
"""Fetch and verify the 15 original NIIM material assets used by the reference UI."""

from __future__ import annotations

import argparse
import hashlib
import json
import struct
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / "src" / "data" / "original-materials.json"


def detect_image(data: bytes) -> tuple[str, int, int]:
    if data.startswith(b"\x89PNG\r\n\x1a\n") and len(data) >= 24:
        width, height = struct.unpack(">II", data[16:24])
        return "png", width, height
    if data.startswith(b"\xff\xd8\xff"):
        index = 2
        while index + 9 < len(data):
            if data[index] != 0xFF:
                index += 1
                continue
            while index < len(data) and data[index] == 0xFF:
                index += 1
            marker = data[index]
            index += 1
            if marker in (0xD8, 0xD9) or 0xD0 <= marker <= 0xD7:
                continue
            if index + 2 > len(data):
                break
            segment_length = struct.unpack(">H", data[index:index + 2])[0]
            if marker in {
                0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7,
                0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF,
            }:
                height, width = struct.unpack(">HH", data[index + 3:index + 7])
                return "jpeg", width, height
            index += segment_length
    raise ValueError("unsupported or corrupt image payload")


def verify(item: dict, data: bytes) -> tuple[str, int, int, str]:
    image_format, width, height = detect_image(data)
    digest = hashlib.sha256(data).hexdigest()
    expected = (item["format"], item["width"], item["height"], item["sha256"])
    actual = (image_format, width, height, digest)
    if actual != expected:
        raise ValueError(f"{item['id']} mismatch: expected={expected}, actual={actual}")
    expected_suffix = ".jpg" if image_format == "jpeg" else f".{image_format}"
    if not item["asset"].lower().endswith(expected_suffix):
        raise ValueError(f"{item['id']} asset extension does not match magic: {item['asset']}")
    return actual


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="verify local files without downloading")
    args = parser.parse_args()
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    for item in manifest["items"]:
        target = ROOT / "public" / item["asset"]
        if args.check:
            data = target.read_bytes()
        else:
            request = urllib.request.Request(item["sourceUrl"], headers={"User-Agent": "niim-label-app-material-fetch/1"})
            with urllib.request.urlopen(request, timeout=30) as response:
                data = response.read()
            verify(item, data)
            target.parent.mkdir(parents=True, exist_ok=True)
            temporary = target.with_suffix(target.suffix + ".tmp")
            temporary.write_bytes(data)
            temporary.replace(target)
        image_format, width, height, digest = verify(item, data)
        print(f"PASS {item['remoteId']} {image_format} {width}x{height} sha256={digest}")
    print(f"Verified {len(manifest['items'])} original material assets")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
