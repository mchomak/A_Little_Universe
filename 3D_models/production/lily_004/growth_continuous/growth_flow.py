import bpy, math, json
from pathlib import Path
from mathutils import Vector
scene=bpy.context.scene
stem=bpy.data.objects['Stem']; keys=stem.data.shape_keys
anchors=[[68,269]+list(range(560,628)),[428],[16]]
controls=[bpy.data.objects[n] for n in ('Head_Root','Leaf_A_Pivot','Leaf_B_Pivot')]
def anchors_now():
 ev=stem.evaluated_get(bpy.context.evaluated_depsgraph_get()); mesh=ev.to_mesh()
 values=[sum((ev.matrix_world @ mesh.vertices[i].co for i in ix),Vector())/len(ix) for ix in anchors]
 ev.to_mesh_clear(); return values
def set_source_frame(f):
 scene_f=1+(f-1)*9/16; whole=math.floor(scene_f); scene.frame_set(whole,subframe=scene_f-whole)
before=[]
for f in range(1,386): set_source_frame(f); before.append(anchors_now())
wave=stem.shape_key_add(name='GrowthFlow',from_mix=False); wave.slider_min=-1; wave.slider_max=1
basis=keys.key_blocks['Basis']
for i,p in enumerate(basis.data):
 t=max(0,min(1,p.co.z/.823)); root=min(1,max(0,(p.co.z-.0015)/.0135)); root=root*root*(3-2*root)
 wave.data[i].co.x += root*t*(.095*math.sin(math.pi*t*1.45)-.025*t)
 wave.data[i].co.y += root*t*(.042*math.sin(math.pi*t*1.2))
track=next(t for t in keys.animation_data.nla_tracks if t.name=='Growth'); strip=track.strips[0]; action=strip.action; slot=strip.action_slot
bag=action.layers[0].strips[0].channelbag(slot)
for curve in list(bag.fcurves):
 if any(n in curve.data_path for n in ('Sprout','EarlyShoot','MidShoot','GrowthFlow')): bag.fcurves.remove(curve)
keys.animation_data.action=action; keys.animation_data.action_slot=slot
for f in range(1,386):
 t=(f-1)/384; g=t+0.025*math.sin(2*math.pi*t)
 if g<=.25: a=g/.25; weights=(1-a,a,0)
 elif g<=.625: a=(g-.25)/.375; weights=(0,1-a,a)
 else: a=(g-.625)/.375; weights=(0,0,1-a)
 for name,value in zip(('Sprout','EarlyShoot','MidShoot'),weights):
  k=keys.key_blocks[name]; k.value=value; k.keyframe_insert(data_path='value',frame=f)
 wave.value=math.sin(2*math.pi*t)*math.sin(math.pi*t)*.85; wave.keyframe_insert(data_path='value',frame=f)
keys.animation_data.action=None
for c in bag.fcurves:
 if any(n in c.data_path for n in ('Sprout','EarlyShoot','MidShoot','GrowthFlow')):
  for p in c.keyframe_points: p.interpolation='LINEAR'
after=[]
for f in range(1,386): set_source_frame(f); after.append(anchors_now())
for j,ctrl in enumerate(controls):
 st=next(t for t in ctrl.animation_data.nla_tracks if t.name=='Growth').strips[0]; cb=st.action.layers[0].strips[0].channelbag(st.action_slot)
 for axis in range(3):
  c=next(c for c in cb.fcurves if c.data_path=='location' and c.array_index==axis)
  assert len(c.keyframe_points)==385
  for p in c.keyframe_points:
   f=round(p.co.x); delta=(after[f-1][j]-before[f-1][j])[axis]
   p.co.y+=delta; p.handle_left.y+=delta; p.handle_right.y+=delta
  c.update()
heights=[v[0].z for v in after]; diffs=[b-a for a,b in zip(heights,heights[1:])]
print('HEIGHT_MONOTONIC',min(diffs),max(diffs),'start/end',heights[0],heights[-1]); assert min(diffs)>0
out=Path(bpy.data.filepath).parent.parent/'candidate'; out.mkdir(parents=True,exist_ok=True)
scene.frame_set(1281); bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(out/'lily_004_growth_flow.blend'))
assert bpy.ops.export_scene.gltf(filepath=str(out/'lily_004_growth_flow.glb'),export_format='GLB',export_animation_mode='NLA_TRACKS',export_anim_slide_to_zero=True,export_optimize_animation_keep_anim_object=True,export_current_frame=True,export_extras=True,export_cameras=False,export_lights=False)=={'FINISHED'}