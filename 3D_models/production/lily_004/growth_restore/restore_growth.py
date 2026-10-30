import bpy
from pathlib import Path
root=Path(bpy.data.filepath).parent.parent
asset=root.parent
out=root/'candidate'
out.mkdir(parents=True,exist_ok=True)
stage=asset/'iteration_02'/'scripts'
exec(compile((stage/'stage01_growth.py').read_text(encoding='utf-8'),str(stage/'stage01_growth.py'),'exec'))
source=(stage/'stage1c_stem_and_leaves.py').read_text(encoding='utf-8').split('scene.frame_set(1281)')[0]
exec(compile(source,str(stage/'stage1c_stem_and_leaves.py'),'exec'))
changed=[]
for obj in bpy.data.objects:
    owners=[obj]
    if obj.type=='MESH' and obj.data.shape_keys: owners.append(obj.data.shape_keys)
    for owner in owners:
        if not owner.animation_data: continue
        for track in owner.animation_data.nla_tracks:
            if track.name=='Growth':
                for strip in track.strips:
                    assert abs(strip.frame_start-1)<0.001 and abs(strip.frame_end-385)<0.001,(obj.name,strip.frame_start,strip.frame_end)
                    strip.scale *= 9/16
                    assert abs(strip.frame_end-217)<0.01,(obj.name,strip.frame_end)
                    changed.append((obj.name,round(strip.frame_end,3)))
print('RETIMED',changed)
scene.frame_set(1281)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(out/'lily_004_growth9.blend'))
result=bpy.ops.export_scene.gltf(filepath=str(out/'lily_004_growth9.glb'),export_format='GLB',export_animation_mode='NLA_TRACKS',export_anim_slide_to_zero=True,export_optimize_animation_keep_anim_object=True,export_current_frame=True,export_extras=True,export_cameras=False,export_lights=False)
assert result=={'FINISHED'}
