import bpy
from pathlib import Path
obj=bpy.data.objects['Flower_Interior'];tr=next(t for t in obj.animation_data.nla_tracks if t.name=='Bloom');st=tr.strips[0];bag=st.action.layers[0].strips[0].channelbag(st.action_slot)
for c in bag.fcurves:
 if c.data_path!='scale':continue
 assert len(c.keyframe_points)==5
 for p,newframe in zip(c.keyframe_points,[1,73,145,230,385]):
  delta=newframe-p.co.x;p.co.x+=delta;p.handle_left.x+=delta;p.handle_right.x+=delta;p.handle_left_type='AUTO_CLAMPED';p.handle_right_type='AUTO_CLAMPED'
 c.update()
 print('CURVE',c.array_index,[(round(p.co.x),round(p.co.y,3)) for p in c.keyframe_points])
out=Path(bpy.data.filepath).parent.parent/'candidate';out.mkdir(parents=True,exist_ok=True);bpy.context.scene.frame_set(1281);bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(out/'lily_004_early_interior.blend'))
assert bpy.ops.export_scene.gltf(filepath=str(out/'lily_004_early_interior.glb'),export_format='GLB',export_animation_mode='NLA_TRACKS',export_anim_slide_to_zero=True,export_optimize_animation_keep_anim_object=True,export_current_frame=True,export_extras=True,export_cameras=False,export_lights=False)=={'FINISHED'}