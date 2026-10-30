import bpy,math
from pathlib import Path
from mathutils import Vector
scene=bpy.context.scene; stem=bpy.data.objects['Stem']; keys=stem.data.shape_keys; basis=keys.key_blocks['Basis']; tip=[68,269]+list(range(560,628)); anchors=[tip,[428],[16]]; ctrls=[bpy.data.objects[n] for n in ('Head_Root','Leaf_A_Pivot','Leaf_B_Pivot')]
def sample():
 e=stem.evaluated_get(bpy.context.evaluated_depsgraph_get()); m=e.to_mesh(); out=[sum((e.matrix_world @ m.vertices[i].co for i in g),Vector())/len(g) for g in anchors];e.to_mesh_clear();return out
def at(f):
 x=1+(f-1)*9/16; i=math.floor(x);scene.frame_set(i,subframe=x-i)
def smooth(x):
 x=max(0,min(1,x));return x*x*(3-2*x)
before=[]
for f in range(1,386):at(f);before.append(sample())
z=[v.co.z for v in basis.data]
# Straighten the young shoot centerline only; the mature geometry stays untouched.
for name in ('Sprout','EarlyShoot'):
 k=keys.key_blocks[name]; co=[p.co.copy() for p in k.data]; bottom=[i for i,h in enumerate(z) if h<.008]; low=sum((co[i] for i in bottom),Vector())/len(bottom); high=sum((co[i] for i in tip),Vector())/len(tip)
 for i,p in enumerate(co):
  t=max(0,min(1,z[i]/.823)); w=[math.exp(-((h-z[i])/.045)**2) for h in z]; total=sum(w);cx=sum(a*b.x for a,b in zip(w,co))/total;cy=sum(a*b.y for a,b in zip(w,co))/total;foot=smooth(z[i]/.014)
  k.data[i].co.x=p.x+(low.x+(high.x-low.x)*t-cx)*foot
  k.data[i].co.y=p.y+(low.y+(high.y-low.y)*t-cy)*foot
track=next(t for t in keys.animation_data.nla_tracks if t.name=='Growth');st=track.strips[0];action=st.action;slot=st.action_slot;bag=action.layers[0].strips[0].channelbag(slot)
# Keep the beginning upright by introducing the existing lateral motion gradually.
flow=next(c for c in bag.fcurves if 'GrowthFlow' in c.data_path)
for p in flow.keyframe_points:
 t=(p.co.x-1)/384; weight=smooth((t-.16)/.22);p.co.y*=weight
flow.update()
# Tip droop develops after the shoot is visible, then relaxes before the bud matures.
k=stem.shape_key_add(name='GrowthWeightedTip',from_mix=False);k.slider_min=0;k.slider_max=1
for i,p in enumerate(basis.data):
 t=max(0,min(1,z[i]/.823));q=max(0,min(1,(t-.65)/.35));q=q*q
 k.data[i].co.x=p.co.x+.085*q;k.data[i].co.y=p.co.y-.012*q;k.data[i].co.z=p.co.z-.075*q
keys.animation_data.action=action;keys.animation_data.action_slot=slot
for f in range(1,386):
 t=(f-1)/384; weight=smooth((t-.18)/.27)*(1-smooth((t-.49)/.34));k.value=weight;k.keyframe_insert(data_path='value',frame=f)
keys.animation_data.action=None
for c in bag.fcurves:
 if 'GrowthWeightedTip' in c.data_path:
  for p in c.keyframe_points:p.interpolation='LINEAR'
after=[]
for f in range(1,386):at(f);after.append(sample())
for j,ctrl in enumerate(ctrls):
 st=next(t for t in ctrl.animation_data.nla_tracks if t.name=='Growth').strips[0];cb=st.action.layers[0].strips[0].channelbag(st.action_slot)
 for axis in range(3):
  c=next(c for c in cb.fcurves if c.data_path=='location' and c.array_index==axis);assert len(c.keyframe_points)==385
  for p in c.keyframe_points:
   f=round(p.co.x);d=(after[f-1][j]-before[f-1][j])[axis];p.co.y+=d;p.handle_left.y+=d;p.handle_right.y+=d
  c.update()
heights=[v[0].z for v in after];d=[b-a for a,b in zip(heights,heights[1:])];print('TIP_HEIGHT_MIN',min(d),'MAX',max(d));assert min(d)>0
out=Path(bpy.data.filepath).parent.parent/'candidate';out.mkdir(parents=True,exist_ok=True);scene.frame_set(1281);bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(out/'lily_004_growth_weighted_tip.blend'))
assert bpy.ops.export_scene.gltf(filepath=str(out/'lily_004_growth_weighted_tip.glb'),export_format='GLB',export_animation_mode='NLA_TRACKS',export_anim_slide_to_zero=True,export_optimize_animation_keep_anim_object=True,export_current_frame=True,export_extras=True,export_cameras=False,export_lights=False)=={'FINISHED'}