"""Run one immutable local experiment; never modifies the source or annotation."""
import argparse, datetime, hashlib, json, platform, shutil, subprocess, sys
from pathlib import Path
import cv2
import numpy as np
from PIL import Image, ImageDraw, __version__ as pillow_version

ROOT = Path(__file__).resolve().parent
EXP = ROOT / 'experiments'
PHOTO = ROOT.parent / 'images' / 'eye_3_1.png'
ANN = EXP / 'annotation_backup' / 'annotation.json'

def digest(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()

def git(*args):
    return subprocess.run(['git', *args], cwd=ROOT, capture_output=True, text=True, encoding='utf-8', errors='replace').stdout.strip()

def diagnostics(out):
    def read(name):
        return np.asarray(Image.open(out / name).convert('RGB'))
    source, corrected, result = map(read, ('iris_unwrapped.png', 'iris_corrected_unwrapped.png', 'iris_cinematic_unwrapped.png'))
    visible = np.asarray(Image.open(out/'unwrapped_visibility.png')) >= 128
    shadow = np.asarray(Image.open(out/'unwrapped_shadow_mask.png')) >= 128
    damage_path = out/'unwrapped_damage_mask.png'
    damage = np.asarray(Image.open(damage_path)) > 0 if damage_path.exists() else np.zeros_like(visible)
    confidence = np.asarray(Image.open(out/'iris_confidence_unwrapped.png'))
    gray = cv2.cvtColor(result, cv2.COLOR_RGB2GRAY).astype(float)
    before = cv2.cvtColor(source, cv2.COLOR_RGB2GRAY).astype(float)
    after = cv2.cvtColor(corrected, cv2.COLOR_RGB2GRAY).astype(float)
    boundary = visible ^ np.roll(visible, 1, axis=1)
    gradients = np.abs(gray - np.roll(gray, 1, axis=1))
    rgba = np.asarray(Image.open(out/'iris_cinematic_rgba.png').convert('RGBA'))
    alpha = rgba[:,:,3]
    count = (out/'iris_particles.bin').stat().st_size // 28
    particles = np.fromfile(out/'iris_particles.bin', dtype='<f4')
    weight_path = out/'unwrapped_synthetic_weight.png'
    weight = np.asarray(Image.open(weight_path)).astype(float)/255 if weight_path.exists() else None
    report = {'real_fraction':float(visible.mean()), 'synthetic_fraction':float((~visible).mean()),
              'fraction_note':'real_fraction is manual visibility, not the final texture provenance',
              'confidence_fraction_by_code':{str(int(x)):float((confidence==x).mean()) for x in np.unique(confidence)},
              'mean_synthetic_blend_weight':float(weight.mean()) if weight is not None else None,
              'fully_synthetic_weight_fraction':float((weight >= .99).mean()) if weight is not None else None,
              'shadow_coverage_fraction':float((shadow & visible).mean()),
              'shadow_mean_before':float(before[shadow & visible].mean()), 'shadow_mean_after':float(after[shadow & visible].mean()),
              'clean_mean':float(before[visible & ~shadow].mean()), 'damage_fraction':float(damage.mean()),
              'boundary_gradient_mean':float(gradients[boundary].mean()) if boundary.any() else 0,
              'angular_wrap_gradient_mean':float(np.abs(gray[:,0]-gray[:,-1]).mean()),
              'radial_rgb_mean':[result[a:b].mean(axis=(0,1)).round(2).tolist() for a,b in ((0,len(result)//3),(len(result)//3,2*len(result)//3),(2*len(result)//3,len(result)))],
              'radial_fiber_contrast':float(np.abs(np.diff(gray,axis=1)).mean()),
              'clipped_channel_fraction':float(((result==0)|(result==255)).mean()),
              'nonfinite_count':int((~np.isfinite(result)).sum()), 'particle_nonfinite_count':int((~np.isfinite(particles)).sum()), 'alpha_range':[int(alpha.min()),int(alpha.max())],
              'texture_size':list(rgba.shape[:2]), 'particle_count':count,
              'particle_bytes_valid':(out/'iris_particles.bin').stat().st_size == count*28,
              'alpha_corner':int(alpha[0,0]), 'alpha_pupil_center':int(alpha[alpha.shape[0]//2,alpha.shape[1]//2]),
              'output_format':Image.open(out/'iris_cinematic_rgba.png').mode,
              'confidence_values':np.unique(confidence).tolist(),
              'note':'Diagnostic measures, not proof of original anatomical texture.'}
    (out/'quality_report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    Image.fromarray(np.concatenate([source,corrected],axis=0)).save(out/'shadow_before_after.png')
    mask=np.stack([~visible, shadow, damage],axis=2).astype(np.uint8)*255
    Image.fromarray(np.concatenate([result,mask],axis=0)).save(out/'reconstruction_debug.png')
    masks=out/'masks'; masks.mkdir(exist_ok=True)
    for name in ('visible_mask.png','shadow_mask.png','unwrapped_visibility.png','unwrapped_shadow_mask.png','unwrapped_damage_mask.png','unwrapped_synthetic_weight.png'):
        if (out/name).exists(): shutil.copy2(out/name,masks/name)
    shutil.copy2(ANN,out/'annotation_snapshot.json')
    return report

def main():
    p=argparse.ArgumentParser(); p.add_argument('--run-label',required=True); p.add_argument('--mode',choices=['illumination','damage','blend','coherent','selective'],required=True); p.add_argument('--seed',type=int,default=42); a=p.parse_args()
    if not a.run_label.replace('_','').replace('-','').isalnum(): p.error('label must contain only letters, digits, hyphens or underscores')
    EXP.mkdir(exist_ok=True)
    numbers=[int(x.name[4:7]) for x in EXP.glob('run_[0-9][0-9][0-9]_*')]
    out=EXP/f'run_{max(numbers,default=0)+1:03d}_{a.run_label}'; out.mkdir()
    code=sorted((ROOT/'iris_baker').glob('*.py'))+[ROOT/'run_iris.py',Path(__file__),ROOT/'requirements.txt']
    params={'mode':a.mode,'seed':a.seed,'angular':2048,'radial':512,'texture_size':1024,'particles':80000,'shadow_strength':.72}
    meta={'timestamp':datetime.datetime.now(datetime.timezone.utc).isoformat(),'git_sha':git('rev-parse','HEAD'),'git_status':git('status','--short','--untracked-files=all'), 'code_sha256':{str(x.relative_to(ROOT)):digest(x) for x in code},'python':sys.version,'dependencies':{'opencv':cv2.__version__,'numpy':np.__version__,'pillow':pillow_version},'input':{'path':str(PHOTO.resolve()),'sha256':digest(PHOTO)},'annotation':{x.name:digest(x) for x in ANN.parent.iterdir() if x.is_file()},'parameters':params}
    (out/'metadata.json').write_text(json.dumps(meta,indent=2,ensure_ascii=False),encoding='utf-8'); (out/'parameters.json').write_text(json.dumps(params,indent=2),encoding='utf-8')
    snapshot = out/'code_snapshot'
    for src in code:
        dest = snapshot/src.relative_to(ROOT)
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dest)
    cmd=[sys.executable,str(ROOT/'run_iris.py'),str(PHOTO),'--annotation',str(ANN),'--output',str(out),'--seed',str(a.seed),'--reconstruction-mode',a.mode]
    proc=subprocess.run(cmd,cwd=ROOT,capture_output=True,text=True,encoding='utf-8',errors='replace')
    (out/'execution.log').write_text('command: '+repr(cmd)+'\n'+proc.stdout+proc.stderr,encoding='utf-8')
    if proc.returncode: raise SystemExit(f'Run failed: {out}, exit {proc.returncode}; see execution.log')
    if any(digest(src) != meta['code_sha256'][str(src.relative_to(ROOT))] for src in code):
        raise SystemExit(f'Code changed while running: {out}; result is not reproducible')
    report = diagnostics(out)
    if (report['texture_size'] != [params['texture_size']]*2 or report['output_format'] != 'RGBA'
            or report['particle_count'] != params['particles'] or not report['particle_bytes_valid']
            or report['particle_nonfinite_count'] or report['alpha_corner'] or report['alpha_pupil_center']):
        raise SystemExit(f'Output validation failed: {out}; see quality_report.json')
    manifest=EXP/'experiments_manifest.json'; entries=json.loads(manifest.read_text(encoding='utf-8')) if manifest.exists() else []
    entries.append({'directory':out.name,'timestamp':meta['timestamp'],'mode':a.mode,'code_sha256':meta['code_sha256']}); manifest.write_text(json.dumps(entries,indent=2),encoding='utf-8')
    print(out)
if __name__=='__main__': main()
