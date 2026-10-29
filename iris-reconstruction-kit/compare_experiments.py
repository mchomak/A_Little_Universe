"""Regenerate local comparison sheets and diagnostic summaries for completed runs."""
import csv, json
from pathlib import Path
from PIL import Image, ImageDraw
from run_experiment import EXP, diagnostics

runs=sorted(p for p in EXP.glob('run_[0-9][0-9][0-9]_*') if (p/'iris_cinematic_preview.png').exists())
for run in runs:
    if not (run/'quality_report.json').exists():
        diagnostics(run)
manifest=EXP/'experiments_manifest.json'
entries=[]
for run in runs:
    meta=json.loads((run/'metadata.json').read_text(encoding='utf-8'))
    entries.append({'directory':run.name,'timestamp':meta['timestamp'],'code_sha256':meta['code_sha256']})
manifest.write_text(json.dumps(entries,indent=2),encoding='utf-8')
out=EXP/'comparisons'; out.mkdir(exist_ok=True)
def label(run):
    meta=json.loads((run/'metadata.json').read_text(encoding='utf-8'))
    hashes = {key.replace('\\', '/'): value for key, value in meta['code_sha256'].items()}
    return run.name+' / '+hashes['iris_baker/reconstruction.py'][:10]
def sheet(filename, crop, size):
    w,h=size; canvas=Image.new('RGB',(w*3,(h+35)*((len(runs)+2)//3)),(15,17,22)); draw=ImageDraw.Draw(canvas)
    for i,run in enumerate(runs):
        with Image.open(run/'iris_cinematic_preview.png') as im:
            tile=im.convert('RGB').crop(crop).resize(size,Image.Resampling.LANCZOS)
        x=(i%3)*w; y=(i//3)*(h+35); canvas.paste(tile,(x,y+35)); draw.text((x+6,y+10),label(run),fill='white')
    canvas.save(out/filename,quality=94,subsampling=0)
sheet('comparison_grid.jpg',(0,0,1024,1024),(440,440))
sheet('shadow_comparison.jpg',(45,310,480,790),(435,480))
sheet('seam_comparison.jpg',(100,340,930,610),(830,270))
with (out/'quality_summary.csv').open('w',newline='',encoding='utf-8') as f:
    keys=['run','real_fraction','synthetic_fraction','fraction_note','mean_synthetic_blend_weight','fully_synthetic_weight_fraction','shadow_coverage_fraction','shadow_mean_before','shadow_mean_after','clean_mean','damage_fraction','boundary_gradient_mean','angular_wrap_gradient_mean','radial_fiber_contrast','clipped_channel_fraction','nonfinite_count','particle_count','particle_bytes_valid']
    writer=csv.DictWriter(f,fieldnames=keys); writer.writeheader()
    for run in runs:
        data=json.loads((run/'quality_report.json').read_text()); writer.writerow({'run':run.name,**{k:data.get(k) for k in keys if k!='run'}})
print('Compared',len(runs),'runs in',out)
