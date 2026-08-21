"""Split the supplied single-mesh golf club GLB into named material regions.

The source exporter duplicated most triangle vertices, so regions are classified
from stable model-space ranges rather than mesh connectivity. The source remains
untouched; this script writes the derived web asset used by the game.
"""

import json
import struct
from pathlib import Path

import numpy as np


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "sloppy-golf" / "media" / "golf-club-driver-source.glb"
OUTPUT = ROOT / "sloppy-golf" / "media" / "golf-club-driver.glb"


def load_glb(path):
    data = path.read_bytes()
    magic, version, length = struct.unpack_from("<4sII", data, 0)
    if magic != b"glTF" or version != 2:
        raise ValueError("Expected a glTF 2.0 binary file")
    offset = 12
    document = binary = None
    while offset < length:
        chunk_length, chunk_type = struct.unpack_from("<II", data, offset)
        payload = data[offset + 8 : offset + 8 + chunk_length]
        offset += 8 + chunk_length
        if chunk_type == 0x4E4F534A:
            document = json.loads(payload.decode("utf-8").rstrip("\x00 "))
        elif chunk_type == 0x004E4942:
            binary = bytearray(payload)
    return document, binary


def accessor_array(document, binary, accessor_index):
    accessor = document["accessors"][accessor_index]
    view = document["bufferViews"][accessor["bufferView"]]
    components = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}[accessor["type"]]
    dtype = {5123: np.uint16, 5125: np.uint32, 5126: np.float32}[accessor["componentType"]]
    offset = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
    return np.frombuffer(binary, dtype=dtype, count=accessor["count"] * components, offset=offset).reshape(accessor["count"], components).copy()


def classify(positions, triangle):
    points = positions[triangle] * 100
    center = points.mean(axis=0)
    minimum = points.min(axis=0)
    maximum = points.max(axis=0)
    normal = np.cross(points[1] - points[0], points[2] - points[0])
    normal_length = np.linalg.norm(normal)
    if normal_length:
        normal /= normal_length
    if center[2] > 1.41:
        return "Grip"
    if center[2] > -0.014:
        return "Shaft"
    if center[2] > -0.13 and max(abs(minimum[0]), abs(maximum[0]), abs(minimum[1]), abs(maximum[1])) < 0.055:
        return "Hosel"
    # The striking face is the wide, shallow -Y-facing surface spanning the
    # head's X/Z dimensions. A +Z rule selects the shield-shaped rear/sole.
    if center[2] < -0.02 and normal_length and normal[1] < -0.50:
        return "Face"
    if center[1] < -0.13:
        return "Sole"
    return "Crown"


def append_indices(document, binary, indices):
    while len(binary) % 4:
        binary.append(0)
    offset = len(binary)
    payload = np.asarray(indices, dtype=np.uint16).tobytes()
    binary.extend(payload)
    view_index = len(document["bufferViews"])
    document["bufferViews"].append({"buffer": 0, "byteOffset": offset, "byteLength": len(payload), "target": 34963})
    accessor_index = len(document["accessors"])
    document["accessors"].append({
        "bufferView": view_index,
        "componentType": 5123,
        "count": len(indices),
        "type": "SCALAR",
        "min": [int(min(indices))],
        "max": [int(max(indices))],
    })
    return accessor_index


def write_glb(path, document, binary):
    document["buffers"][0]["byteLength"] = len(binary)
    json_payload = json.dumps(document, separators=(",", ":")).encode("utf-8")
    json_payload += b" " * ((4 - len(json_payload) % 4) % 4)
    binary.extend(b"\x00" * ((4 - len(binary) % 4) % 4))
    total = 12 + 8 + len(json_payload) + 8 + len(binary)
    output = bytearray(struct.pack("<4sII", b"glTF", 2, total))
    output.extend(struct.pack("<II", len(json_payload), 0x4E4F534A))
    output.extend(json_payload)
    output.extend(struct.pack("<II", len(binary), 0x004E4942))
    output.extend(binary)
    path.write_bytes(output)


def main():
    document, binary = load_glb(SOURCE)
    source_primitive = document["meshes"][0]["primitives"][0]
    positions = accessor_array(document, binary, source_primitive["attributes"]["POSITION"])
    triangles = accessor_array(document, binary, source_primitive["indices"]).reshape(-1, 3)
    names = ["Grip", "Shaft", "Hosel", "Crown", "Face", "Sole"]
    colors = {
        "Grip": [0.035, 0.045, 0.055, 1],
        "Shaft": [0.18, 0.22, 0.24, 1],
        "Hosel": [0.32, 0.37, 0.39, 1],
        "Crown": [0.19, 0.22, 0.24, 1],
        "Face": [0.025, 0.04, 0.055, 1],
        "Sole": [0.52, 0.56, 0.57, 1],
    }
    document["materials"] = [
        {"name": name, "pbrMetallicRoughness": {"baseColorFactor": colors[name], "metallicFactor": 0.25 if name != "Shaft" else 0.65, "roughnessFactor": 0.38}}
        for name in names
    ]
    regions = {name: [] for name in names}
    for triangle in triangles:
        regions[classify(positions, triangle)].extend(int(index) for index in triangle)
    primitives = []
    for material_index, name in enumerate(names):
        if not regions[name]:
            continue
        primitives.append({
            "attributes": source_primitive["attributes"],
            "indices": append_indices(document, binary, regions[name]),
            "material": material_index,
            "mode": 4,
        })
        print(f"{name}: {len(regions[name]) // 3} triangles")
    document["meshes"][0]["name"] = "EverElms Modular Driver"
    document["meshes"][0]["primitives"] = primitives
    document["nodes"][1]["name"] = "EverElms_Driver"
    write_glb(OUTPUT, document, binary)
    print(f"Wrote {OUTPUT} ({OUTPUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
