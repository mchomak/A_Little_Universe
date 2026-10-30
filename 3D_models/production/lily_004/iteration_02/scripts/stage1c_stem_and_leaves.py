"""Growth revision: a travelling stem bend and unfolding young leaves."""
import bpy, math
from pathlib import Path
from mathutils import Vector

root = Path(bpy.data.filepath).parent.parent
scene = bpy.context.scene
stem = bpy.data.objects['Stem']
anchors = [[68,269]+list(range(560,628)),[428],[16]]
controls = [bpy.data.objects[n] for n in ('Head_Root','Leaf_A_Pivot','Leaf_B_Pivot')]

def anchors_now():
    ev=stem.evaluated_get(bpy.context.evaluated_depsgraph_get()); m=ev.to_mesh()
    result=[sum((ev.matrix_world @ m.vertices[i].co for i in indices),Vector())/len(indices) for indices in anchors]
    ev.to_mesh_clear(); return result

before=[]
for frame in range(1,386):
    scene.frame_set(frame); before.append(anchors_now())

# Tip leads left while the middle stays bowed the other way. The existing
# Growth weights bring both offsets to zero as the final Basis is reached.
for name, tip, belly in [('EarlyShoot',-.075,.035),('MidShoot',-.090,.055)]:
    shape=stem.data.shape_keys.key_blocks[name]
    for i,v in enumerate(stem.data.vertices):
        t=max(0.,min(1.,v.co.z/.823))
        u=max(0.,min(1.,(v.co.z-.0015)/.0135)); u=u*u*(3.-2.*u)
        shape.data[i].co.x += u*(tip*t*t + belly*math.sin(math.pi*t))

after=[]
for frame in range(1,386):
    scene.frame_set(frame); after.append(anchors_now())
for j,ctrl in enumerate(controls):
    strip=next(t for t in ctrl.animation_data.nla_tracks if t.name=='Growth').strips[0]
    bag=strip.action.layers[0].strips[0].channelbag(strip.action_slot)
    for axis in range(3):
        curve=next(c for c in bag.fcurves if c.data_path=='location' and c.array_index==axis)
        assert len(curve.keyframe_points)==385
        for p in curve.keyframe_points:
            f=round(p.co.x); delta=(after[f-1][j]-before[f-1][j])[axis]
            p.co.y+=delta; p.handle_left.y+=delta; p.handle_right.y+=delta
        curve.update()

# Replace the existing young shape with an upright, narrow curved shoot.
# Coordinates are computed in pivot space, so the base stays on the pivot.
# YoungFolded's existing Growth animation opens it into the mature Basis.
for name in ('Leaf_A','Leaf_B'):
    leaf=bpy.data.objects[name]; basis=leaf.data.shape_keys.key_blocks['Basis']
    young=leaf.data.shape_keys.key_blocks['YoungFolded']; mat=leaf.matrix_local.copy(); inv=mat.inverted()
    points=[mat @ k.co for k in basis.data]
    far=max(points,key=lambda p:p.length)
    axis=far.normalized(); length=max(p.dot(axis) for p in points)
    up=Vector((0,0,1)); horizontal=Vector((axis.x,axis.y,0)).normalized()
    direction=(up+horizontal*.25).normalized(); rotation=axis.rotation_difference(direction)
    for i,p in enumerate(points):
        along=max(0.,p.dot(axis)); t=max(0.,min(1.,along/length))
        cross=p-axis*p.dot(axis)
        centre=length*.75*(up*t+horizontal*(.26*t*t))
        young.data[i].co=inv @ (centre+(rotation @ cross)*.16)
    print('LEAF',name,'length',length,'axis',tuple(axis))

scene.frame_set(1281)
blend=root/'versions'/'lily_004_v2_stage1c_growth.blend'
glb=root/'export'/'lily_004_v2_stage1c_growth.glb'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(blend))
result=bpy.ops.export_scene.gltf(filepath=str(glb),export_format='GLB',export_animation_mode='NLA_TRACKS',export_anim_slide_to_zero=True,export_optimize_animation_keep_anim_object=True,export_current_frame=True)
assert result=={'FINISHED'}
print('STAGE1B_SAVED',blend,glb,glb.stat().st_size)
