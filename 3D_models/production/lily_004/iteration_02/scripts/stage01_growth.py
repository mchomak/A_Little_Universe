"""Delay the bud and give each leaf a folded young state, preserving V1 NLA."""
import bpy
from mathutils import Vector

scene = bpy.context.scene

def replace_scale(owner, samples):
    track = next(t for t in owner.animation_data.nla_tracks if t.name == 'Growth')
    strip = track.strips[0]
    action, slot = strip.action, strip.action_slot
    bag = action.layers[0].strips[0].channelbag(slot)
    for curve in list(bag.fcurves):
        if curve.data_path == 'scale':
            bag.fcurves.remove(curve)
    owner.animation_data.action = action
    owner.animation_data.action_slot = slot
    for frame, value in samples:
        owner.scale = (value,)*3
        owner.keyframe_insert(data_path='scale', frame=frame)
    owner.animation_data.action = None

# The bud begins to develop only after the stem and leaves are recognisable.
replace_scale(bpy.data.objects['Head_Root'], [
    (1,.001), (217,.001), (241,.012), (265,.055), (313,.34), (361,.86), (385,1.)])

# Leaf B is lower and appears first; Leaf A follows. Their independent shape
# keys narrow the blade before its local scale grows to full size.
leaf_samples = {
    'Leaf_B': [(1,.001),(73,.001),(97,.06),(145,.28),(193,.65),(241,1.),(385,1.)],
    'Leaf_A': [(1,.001),(145,.001),(169,.035),(217,.25),(265,.7),(313,1.),(385,1.)],
}
for name, samples in leaf_samples.items():
    leaf = bpy.data.objects[name]
    leaf.data = leaf.data.copy()
    pivot = bpy.data.objects[name + '_Pivot']
    replace_scale(pivot, samples)
    leaf.shape_key_add(name='Basis', from_mix=False)
    folded = leaf.shape_key_add(name='YoungFolded', from_mix=False)
    root = leaf.matrix_local.inverted() @ Vector((0.,0.,0.))
    far = max(leaf.data.vertices, key=lambda v:(v.co-root).length).co.copy()
    axis = (far-root).normalized()
    for i, vertex in enumerate(leaf.data.vertices):
        delta = vertex.co-root
        along = axis * delta.dot(axis)
        across = delta-along
        folded.data[i].co = root + along*.82 + across*.13
    fold = [(1,1.),(samples[2][0],1.),(samples[3][0],.76),(samples[4][0],.32),(samples[5][0],0.),(385,0.)]
    for frame,value in fold:
        folded.value=value
        folded.keyframe_insert(data_path='value',frame=frame)
    data=leaf.data.shape_keys.animation_data
    action=data.action
    slot=data.action_slot
    action.name='Growth__'+name+'_YoungFolded'
    data.action=None
    track=data.nla_tracks.new();track.name='Growth'
    strip=track.strips.new('Growth',1,action)
    if slot is not None:strip.action_slot=slot

scene.frame_set(385)
print('GROWTH_V2',[(n, len(bpy.data.objects[n].data.shape_keys.key_blocks)) for n in leaf_samples])
