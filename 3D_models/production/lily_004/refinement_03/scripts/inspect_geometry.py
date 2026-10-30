"""Print compact evaluated petal-grid diagnostics for an opened geometry blend."""

import bpy


scene = bpy.context.scene
obj = bpy.data.objects["Petals"]
for frame in (1, 109, 217, 505, 673, 721, 769, 817, 865):
    scene.frame_set(frame)
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    areas = [polygon.area for polygon in mesh.polygons]
    print("FRAME", frame, "active_keys", [
        (key.name, round(key.value, 4))
        for key in obj.data.shape_keys.key_blocks if abs(key.value) > 1e-7
    ])
    print("AREA", min(areas), sum(area < 1e-10 for area in areas),
          sorted(areas)[max(0, int(len(areas) * 0.01) - 1)], len(areas))
    if frame == 865:
        for island in (0, 5):
            print("ISLAND", island + 1)
            for row in (0, 8, 16, 24, 28, 30, 31, 32):
                coords = [evaluated.matrix_world @ mesh.vertices[island * 495 + row * 15 + column].co
                          for column in (0, 3, 7, 11, 14)]
                print("ROW", row, [tuple(round(point[axis], 4) for axis in range(3))
                                   for point in coords])
    evaluated.to_mesh_clear()

for frame in (1, 37, 73, 109, 145, 181, 217):
    scene.frame_set(frame)
    depsgraph = bpy.context.evaluated_depsgraph_get()
    print("GROWTH", frame)
    for name in ("Lily_Root", "Stem", "Head_Root", "Leaf_A_Pivot", "Leaf_B_Pivot"):
        obj = bpy.data.objects[name]
        evaluated = obj.evaluated_get(depsgraph)
        print("TRANSFORM", name,
              "location", tuple(round(v, 4) for v in evaluated.matrix_world.translation),
              "scale", tuple(round(v, 4) for v in evaluated.matrix_world.to_scale()))
        if obj.data and getattr(obj.data, "shape_keys", None):
            print("KEYS", name, [(key.name, round(key.value, 4))
                                  for key in obj.data.shape_keys.key_blocks])
        if evaluated.type == "MESH":
            mesh = evaluated.to_mesh()
            coords = [evaluated.matrix_world @ vertex.co for vertex in mesh.vertices]
            sizes = [max(point[axis] for point in coords) - min(point[axis] for point in coords)
                     for axis in range(3)]
            print("BOUNDS", name, tuple(round(v, 4) for v in sizes))
            evaluated.to_mesh_clear()

for object_name in ("Petals", "Petals_Outside", "Stem", "Leaf_A", "Leaf_B"):
    obj = bpy.data.objects[object_name]
    keys = obj.data.shape_keys if obj.data and getattr(obj.data, "shape_keys", None) else None
    if not keys:
        continue
    print("GROWTH_CURVES", object_name)
    for track in keys.animation_data.nla_tracks:
        if track.name != "Growth" or not track.strips:
            continue
        action_slot = track.strips[0].action_slot
        print("ACTION", track.strips[0].action.name, "slot", action_slot,
              "slot_handle", action_slot.handle if action_slot else None,
              "slot_attrs", [name for name in dir(action_slot) if not name.startswith("_")] if action_slot else [])
        print("ACTION_SLOTS", [(slot.identifier, slot.handle) for slot in track.strips[0].action.slots])
        action = track.strips[0].action
        for layer in action.layers:
            for action_strip in layer.strips:
                for bag in action_strip.channelbags:
                    print("BAG", bag.slot_handle, "fcurve_type", bag.fcurves.bl_rna.identifier,
                          "new", hasattr(bag.fcurves, "new"))
                    for curve in bag.fcurves:
                        frames = [(round(point.co.x, 3), round(point.co.y, 3))
                                  for point in curve.keyframe_points]
                        print("CURVE", curve.data_path, curve.array_index, frames)
    basis = keys.key_blocks["Basis"].data
    for key in keys.key_blocks[1:]:
        magnitudes = [(key.data[index].co - basis[index].co).length for index in range(len(basis))]
        print("MORPH", key.name, round(max(magnitudes), 6),
              sum(value > 1e-5 for value in magnitudes))
