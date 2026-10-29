"""Repository-friendly command line for offline Iris Baker v1.2."""
from __future__ import annotations
import argparse
from pathlib import Path
import sys
import cv2
from .image_io import load_rgb
from .detection import propose_circles
from .geometry import Ellipse, validate_geometry
from .annotation import initial_annotation,load_annotation
from .annotation_editor import edit_annotation
from .pipeline import bake


def parser():
    p=argparse.ArgumentParser(prog='iris-bake', description='Offline iris/eye asset baker; HEIC/PNG/JPG/TIFF/WebP',
                              formatter_class=argparse.ArgumentDefaultsHelpFormatter)
    p.add_argument('--input','-i',type=Path,required=True,help='Photo of ONE eye')
    p.add_argument('--output','-o',type=Path,help='Target directory (default: outputs/<input stem>)')
    p.add_argument('--crop',nargs=4,type=int,metavar=('X','Y','W','H'),help='Optional crop in oriented image pixels')
    p.add_argument('--pupil',nargs=3,type=float,metavar=('CX','CY','R'),help='Explicit pupil circle')
    p.add_argument('--iris',nargs=3,type=float,metavar=('CX','CY','R'),help='Explicit outer iris circle')
    p.add_argument('--pupil-ry',type=float,help='Optional vertical pupil radius for elliptical mask')
    p.add_argument('--iris-ry',type=float,help='Optional vertical iris radius for elliptical mask')
    p.add_argument('--pupil-angle',type=float,default=0)
    p.add_argument('--iris-angle',type=float,default=0)
    p.add_argument('--interactive',action='store_true',help='Edit both contours and masks in GUI')
    p.add_argument('--annotation',type=Path,help='Reuse annotation.json from previous run')
    p.add_argument('--no-auto',action='store_true',help='Disable automatic contour proposal')
    p.add_argument('--occlusion-mask',type=Path,help='External visibility mask, WHITE=usable, BLACK=hidden; same photo dimensions')
    p.add_argument('--shadow-mask',type=Path,help='External shadow mask, WHITE=shaded, BLACK=not marked')
    p.add_argument('--shadow-strength',type=float,default=.72,help='Conservative L* correction of marked shadow (0..1)')
    p.add_argument('--particles',type=int,default=80000,help='Particles per each of authentic/cinematic outputs')
    p.add_argument('--angular',type=int,default=2048,help='Polar angular width')
    p.add_argument('--radial',type=int,default=512,help='Polar radial height')
    p.add_argument('--texture-size',type=int,default=1024,help='Square iris texture side in pixels')
    p.add_argument('--seed',type=int,default=42)
    p.add_argument('--reconstruction-mode', choices=('legacy','illumination','damage','blend','coherent','selective'), default='legacy', help='Experimental reconstruction variant')
    return p


def main(argv=None) -> int:
    args=parser().parse_args(argv)
    try:
        if bool(args.pupil) != bool(args.iris):
            raise ValueError('Set both --pupil and --iris or neither')
        if not (256<=args.angular<=8192 and 64<=args.radial<=2048):
            raise ValueError('Polar dimensions out of range: angular 256..8192, radial 64..2048')
        if not (256<=args.texture_size<=4096 and 100<=args.particles<=2_000_000):
            raise ValueError('Texture 256..4096 and particles 100..2,000,000 required')
        if not 0<=args.shadow_strength<=1:
            raise ValueError('--shadow-strength must be between 0 and 1')
        rgb=load_rgb(args.input)
        h,w=rgb.shape[:2]
        crop=tuple(args.crop) if args.crop else None
        if crop:
            x,y,cw,ch=crop
            if min(x,y)<0 or min(cw,ch)<1 or x+cw>w or y+ch>h:
                raise ValueError('--crop is outside image')
            rgb=rgb[y:y+ch,x:x+cw].copy()
        ph,pw=rgb.shape[:2]
        pupil=iris=None
        method='automatic_unverified'
        if args.annotation:
            ann=load_annotation(args.annotation,(ph,pw))
            pupil,iris=ann.pupil,ann.iris
            method='saved_annotation'
        else:
            if args.pupil:
                x,y,r=args.pupil
                pupil=Ellipse(x,y,r,args.pupil_ry or r,args.pupil_angle)
                x,y,r=args.iris
                iris=Ellipse(x,y,r,args.iris_ry or r,args.iris_angle)
                method='manual_coordinates'
            elif not args.no_auto:
                try:
                    pupil,iris=propose_circles(rgb)
                    print('[AUTO] Proposal only! Review contour locations manually.')
                except ValueError as exc:
                    print(f'[AUTO] Could not propose circles: {exc}')
                    if not args.interactive:
                        raise ValueError('Try --interactive or provide manual coordinates') from exc
            if args.no_auto and not args.interactive and pupil is None:
                raise ValueError('--no-auto needs --interactive or explicit --pupil/--iris')
            ann=initial_annotation((ph,pw),pupil,iris)
        if args.interactive:
            print('[GUI] O outer iris points, K pupil points: click center + 8-24 rim points, C confirm; P/I circles; X hide lashes; S shadow; Enter export.')
            ann=edit_annotation(rgb,ann)
            pupil,iris=ann.pupil,ann.iris
            method='interactive_annotated'
        if pupil is None or iris is None:
            raise ValueError('Contours missing. Use --interactive or --annotation.')
        validate_geometry(pupil,iris,pw,ph)
        dest=args.output or Path('outputs')/args.input.stem
        # bake writes fixed filenames; never allow them to replace the input or
        # the annotation and masks being reused in this same invocation.
        protected = [args.input, args.annotation, args.occlusion_mask, args.shadow_mask]
        if any(path is not None and path.resolve().parent == dest.resolve() for path in protected):
            raise ValueError('Output directory must differ from the input and annotation/mask directories')
        data=bake(args.input,dest,pupil,iris,crop,args.angular,args.radial,
                  args.texture_size,args.particles,args.seed,method,args.occlusion_mask,
                  args.shadow_mask,ann,args.shadow_strength,args.reconstruction_mode)
        print(f'\n[DONE] {Path(dest).resolve()}')
        print('  contact_sheet.jpg          overview / quality check')
        print('  annotation.json            can be reused with --annotation')
        print('  iris_authentic_rgba.png     only photographed usable regions')
        print('  iris_cinematic_rgba.png    reconstructed artistic full iris')
        print('  iris_confidence.png        provenance map; see metadata for category meanings')
        print('  full_eye_composite.png     photo-based static eye preview')
        print('  full_eye_foreground_rgba.png photo-based eyelid/lash layer')
        print('  iris_particles.bin         cinematic GPU points, 7 float32 each')
        print(f"  visible real fraction: {data['annotation']['visibleFractionPolar']:.1%}")
        if method == 'automatic_unverified':
            print('[WARNING] Automatic geometry is not reviewed. Use --interactive.')
        return 0
    except (OSError,ValueError,RuntimeError,KeyboardInterrupt,cv2.error) as exc:
        print(f'[ERROR] {exc}',file=sys.stderr)
        return 2
