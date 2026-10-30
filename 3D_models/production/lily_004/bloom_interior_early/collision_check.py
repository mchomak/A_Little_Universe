import bpy
from mathutils.bvhtree import BVHTree
scene=bpy.context.scene
for sec in [3,4,5,6,8,10,12]:
 scene.frame_set(673+round(sec*24)); dg=bpy.context.evaluated_depsgraph_get();bpy.context.view_layer.update()
 base=bpy.data.objects['Flower_Interior'].evaluated_get(dg).matrix_world.translation.copy(); data=[]
 for name in ['Flower_Details','Petals','Petals_Outside']:
  e=bpy.data.objects[name].evaluated_get(dg);m=e.to_mesh();m.calc_loop_triangles(); verts=[e.matrix_world @ v.co for v in m.vertices]; tris=[tuple(t.vertices) for t in m.loop_triangles];tree=BVHTree.FromPolygons(verts,tris,all_triangles=True);data.append((verts,tris,tree));e.to_mesh_clear()
 vals=[]
 for i in [1,2]:
  pairs=data[0][2].overlap(data[i][2]);outside=0
  for a,b in pairs:
   verts,tris,_=data[0];center=sum((verts[k] for k in tris[a]),__import__('mathutils').Vector())/3
   if (center-base).length>.025:outside+=1
  vals.append((len(pairs),outside))
 print('COLLISIONS',sec,vals)