"""Downsize embedded golfer textures while preserving GLB geometry/animation.

The source GLB is generated from the untouched user FBX with FBX2glTF at a
30 fps animation bake. This step only rebuilds buffer views and replaces the
embedded 4K/2K PNG payloads with mobile-appropriate PNGs.
"""

from __future__ import annotations

import io
import json
import struct
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "sloppy-golf" / "media" / "golf-drive-runtime.glb"
OUTPUT = ROOT / "sloppy-golf" / "media" / "golf-drive-runtime-optimized.glb"


def padded(data: bytes, fill: bytes) -> bytes:
    return data + fill * ((-len(data)) % 4)


def texture_limit(name: str) -> int:
    return 512 if "1002" in name else 1024


def optimize_png(data: bytes, name: str) -> bytes:
    with Image.open(io.BytesIO(data)) as image:
        image.load()
        limit = texture_limit(name)
        if max(image.size) > limit:
            image.thumbnail((limit, limit), Image.Resampling.LANCZOS)
        output = io.BytesIO()
        image.save(output, format="PNG", optimize=True, compress_level=9)
        return output.getvalue()


def main() -> None:
    source = SOURCE.read_bytes()
    magic, version, _ = struct.unpack_from("<4sII", source, 0)
    if magic != b"glTF" or version != 2:
        raise ValueError("Expected a binary glTF 2.0 source")

    json_length, json_type = struct.unpack_from("<II", source, 12)
    if json_type != 0x4E4F534A:
        raise ValueError("Missing GLB JSON chunk")
    document = json.loads(source[20 : 20 + json_length])
    binary_header = 20 + json_length
    binary_length, binary_type = struct.unpack_from("<II", source, binary_header)
    if binary_type != 0x004E4942:
        raise ValueError("Missing GLB binary chunk")
    binary = source[binary_header + 8 : binary_header + 8 + binary_length]

    image_views = {image["bufferView"]: image for image in document.get("images", [])}
    rebuilt = bytearray()
    texture_report = []
    for index, view in enumerate(document["bufferViews"]):
        start = view.get("byteOffset", 0)
        payload = binary[start : start + view["byteLength"]]
        image = image_views.get(index)
        if image and image.get("mimeType") == "image/png":
            original_length = len(payload)
            payload = optimize_png(payload, image.get("name", f"image-{index}"))
            texture_report.append((image.get("name", f"image-{index}"), original_length, len(payload)))
        view["byteOffset"] = len(rebuilt)
        view["byteLength"] = len(payload)
        rebuilt.extend(payload)
        rebuilt.extend(b"\x00" * ((-len(rebuilt)) % 4))

    document["buffers"][0]["byteLength"] = len(rebuilt)
    json_bytes = padded(json.dumps(document, separators=(",", ":")).encode("utf-8"), b" ")
    binary_bytes = padded(bytes(rebuilt), b"\x00")
    total_length = 12 + 8 + len(json_bytes) + 8 + len(binary_bytes)
    glb = bytearray(struct.pack("<4sII", b"glTF", 2, total_length))
    glb.extend(struct.pack("<II", len(json_bytes), 0x4E4F534A))
    glb.extend(json_bytes)
    glb.extend(struct.pack("<II", len(binary_bytes), 0x004E4942))
    glb.extend(binary_bytes)
    OUTPUT.write_bytes(glb)

    print(f"Wrote {OUTPUT.name}: {len(source):,} -> {len(glb):,} bytes")
    for name, before, after in texture_report:
        print(f"  {name}: {before:,} -> {after:,} bytes")


if __name__ == "__main__":
    main()
