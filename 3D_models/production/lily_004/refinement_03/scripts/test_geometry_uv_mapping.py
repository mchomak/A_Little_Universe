"""Prove per-vertex UV snapshots are exact for the current tepal source."""

from collections import defaultdict
import bpy


mapping = {}
for object_name in ("Petals", "Petals_Outside"):
    mesh = bpy.data.objects[object_name].data
    for layer in mesh.uv_layers:
        values_by_vertex = defaultdict(set)
        for loop_index, loop in enumerate(mesh.loops):
            uv = layer.data[loop_index].uv
            values_by_vertex[loop.vertex_index].add((float(uv.x), float(uv.y)))
        counts = [len(values_by_vertex[index]) for index in range(len(mesh.vertices))]
        mapping[f"{object_name}.{layer.name}"] = {
            "vertices": len(mesh.vertices),
            "vertices_with_one_uv": sum(count == 1 for count in counts),
            "vertices_with_multiple_uvs": sum(count > 1 for count in counts),
            "minimum_uvs_per_vertex": min(counts),
            "maximum_uvs_per_vertex": max(counts),
        }
        assert all(count == 1 for count in counts), (object_name, layer.name, mapping)

assert set(mapping) == {"Petals.UVMap", "Petals_Outside.UVMap"}, mapping
print("GEOMETRY_UV_VERTEX_MAPPING PASS", mapping)
