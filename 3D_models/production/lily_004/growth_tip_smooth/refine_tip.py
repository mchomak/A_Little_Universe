import bpy,math
from pathlib import Path
from mathutils import Vector
scene=bpy.context.scene; stem=bpy.data.objects['Stem']; keys=stem.data.shape_keys; basis=keys.key_blocks['Basis']; tipids=[68,269]+list(range(560,628)); anchors=[tipids,[428],[16]]; ctrls=[bpy.data.objects[n] for n in ('Head_Root','Leaf_A_Pivot','Leaf_B_Pivot')]
def sample():
 e=stem.evaluated_get(bpy.context.evaluated_depsgraph_get()); m=e.to_mesh(); out=[sum((e.matrix_world @ m.vertices[i].co for i in g),Vector())/len(g) for g in anchors]; e.to_mesh_clear(); return out
def at(f):
 x=1+(f-1)*9/16; i=math.floor(x);scene.frame_set(i,subframe=x-i)
before=[]
for f in range(1,386): at(f); before.append(sample())
z=[v.co.z for v in basis.data]
for name in ('Sprout','EarlyShoot','MidShoot'):
 key=keys.key_blocks[name]; coords=[p.co.copy() for p in key.data]
 bottom=[i for i,x in enumerate(z) if x<.008]; top=tipids
 low=sum((coords[i] for i in bottom),Vector())/len(bottom); high=sum((coords[i] for i in top),Vector())/len(top)
 for i,p in enumerate(coords):
  t=max(0,min(1,z[i]/.823)); weights=[math.exp(-((zz-z[i])/.045)**2) for zz in z]; total=sum(weights)
  cx=sum(w*co.x for w,co in zip(weights,coords))/total; cy=sum(w*co.y for w,co in zip(weights,coords))/total
  blend=.28*t+.72*t*t*t
  dx=low.x+(high.x-low.x)*blend-cx; dy=low.y+(high.y-low.y)*blend-cy
  # keep existing foot attachment and eliminate abrupt per-vertex correction
  foot=max(0,min(1,z[i]/.014)); foot=foot*foot*(3-2*foot)
  key.data[i].co.x=p.x+dx*foot; key.data[i].co.y=p.y+dy*foot
wave=keys.key_blocks['GrowthFlow']
for i,p in enumerate(basis.data):
 t=max(0,min(1,p.co.z/.823)); q=max(0,min(1,(t-.38)/.62)); q=q*q*q*(q*(q*6-15)+10)
 wave.data[i].co.x=p.co.x+.072*q; wave.data[i].co.y=p.co.y+.035*q; wave.data[i].co.z=p.co.z
after=[]
for f in range(1,386): at(f); after.append(sample())
for j,ctrl in enumerate(ctrls):
 st=next(t for t in ctrl.animation_data.nla_tracks if t.name=='Growth').strips[0]; bag=st.action.layers[0].strips[0].channelbag(st.action_slot)
 for axis in range(3):
  curve=next(c for c in bag.fcurves if c.data_path=='location' and c.array_index==axis); assert len(curve.keyframe_points)==385
  for p in curve.keyframe_points:
   f=round(p.co.x);d=(after[f-1][j]-before[f-1][j])[axis];p.co.y+=d;p.handle_left.y+=d;p.handle_right.y+=d
  curve.update()
zv=[v[0].z for v in after]; ds=[b-a for a,b in zip(zv,zv[1:])]; print('HEIGHT_MIN_STEP',min(ds)); assert min(ds)>0
out=Path(bpy.data.filepath).parent.parent/'candidate';out.mkdir(parents=True,exist_ok=True)
scene.frame_set(1281);bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(out/'lily_004_growth_tip_smooth.blend'))
assert bpy.ops.export_scene.gltf(filepath=str(out/'lily_004_growth_tip_smooth.glb'),export_format='GLB',export_animation_mode='NLA_TRACKS',export_anim_slide_to_zero=True,export_optimize_animation_keep_anim_object=True,export_current_frame=True,export_extras=True,export_cameras=False,export_lights=False)=={'FINISHED'}