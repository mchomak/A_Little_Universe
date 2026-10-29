"""Single-window photo editor: circle or point-based contours, masks and shadows.

The viewport is display-scaled, but strokes always write to full-resolution masks.
No remote processing. Use 'g' to cycle through guidance hints, and see README_RU.md.
"""
from __future__ import annotations
import cv2
import numpy as np
from .annotation import Annotation
from .geometry import Ellipse


def edit_annotation(rgb: np.ndarray, ann: Annotation) -> Annotation:
    h, w = rgb.shape[:2]
    view_w, view_h = min(w, 1200), min(h, 780)
    zoom = 1.0
    fit = min(view_w / w, view_h / h)
    panx, pany = w / 2, h / 2
    mode = 'p' if ann.pupil is None else 'i' if ann.iris is None else 'x'
    center = None
    brush = max(3, int(round(min(w, h) * .015)))
    drawing = False
    last_paint = None
    polygon: list[tuple[int, int]] = []
    outline_center: tuple[int,int] | None = None
    outline_points: list[tuple[int,int]] = []
    undo_stack: list[tuple[np.ndarray, np.ndarray]] = []
    show_help = True
    win = 'Iris Baker v1.3 | o outer points | k pupil points | masks | Enter export'
    base = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)

    def remember():
        undo_stack.append((ann.visible.copy(), ann.shadow.copy()))
        if len(undo_stack) > 8:
            del undo_stack[0]

    def view():
        scale = fit * zoom
        # transform image coords to viewport through affine warping
        ox = view_w / 2 - panx * scale
        oy = view_h / 2 - pany * scale
        a = np.float32([[scale, 0, ox], [0, scale, oy]])
        return scale, ox, oy, a

    def from_screen(mx, my):
        scale, ox, oy, _ = view()
        return (int(np.clip(round((mx - ox) / scale), 0, w - 1)),
                int(np.clip(round((my - oy) / scale), 0, h - 1)))

    def paint(x, y):
        if mode == 'x':
            cv2.circle(ann.visible, (x, y), brush, 0, -1, cv2.LINE_8)
        elif mode == 'v':
            cv2.circle(ann.visible, (x, y), brush, 255, -1, cv2.LINE_8)
        elif mode == 's':
            cv2.circle(ann.shadow, (x, y), brush, 255, -1, cv2.LINE_8)
        elif mode == 'n':
            cv2.circle(ann.shadow, (x, y), brush, 0, -1, cv2.LINE_8)

    def handler(event, mx, my, flags, userdata):
        nonlocal center, outline_center, drawing, last_paint, zoom, panx, pany
        x, y = from_screen(mx, my)
        if event == cv2.EVENT_LBUTTONDOWN:
            if mode in ('p', 'i'):
                if center is None:
                    center = (x, y)
                else:
                    radius = float(np.hypot(x - center[0], y - center[1]))
                    if radius >= 2:
                        setattr(ann, 'pupil' if mode == 'p' else 'iris',
                                Ellipse(float(center[0]), float(center[1]), radius, radius))
                    center = None
            elif mode in ('o', 'k'):
                if outline_center is None:
                    outline_center = (x, y)
                else:
                    outline_points.append((x,y))
            elif mode in ('x', 'v', 's', 'n'):
                remember()
                drawing = True
                last_paint = (x, y)
                paint(x, y)
            elif mode in ('X', 'S'):
                polygon.append((x, y))
        elif event == cv2.EVENT_MOUSEMOVE and drawing:
            if last_paint is not None:
                target = ann.visible if mode in ('x', 'v') else ann.shadow
                color = 0 if mode in ('x', 'n') else 255
                cv2.line(target, last_paint, (x, y), color, brush*2, cv2.LINE_8)
            paint(x, y)
            last_paint = (x, y)
        elif event == cv2.EVENT_LBUTTONUP:
            drawing = False
            last_paint = None
        elif event == cv2.EVENT_MOUSEWHEEL:
            factor = 1.25 if flags > 0 else 1 / 1.25
            before = from_screen(mx, my)
            zoom = float(np.clip(zoom * factor, 1, 12))
            scale = fit * zoom
            panx = before[0] - (mx - view_w/2)/scale
            pany = before[1] - (my - view_h/2)/scale

    try:
        cv2.namedWindow(win, cv2.WINDOW_NORMAL)
        cv2.resizeWindow(win, view_w, view_h)
        cv2.setMouseCallback(win, handler)
        while True:
            scale, ox, oy, matrix = view()
            frame = cv2.warpAffine(base, matrix, (view_w, view_h), flags=cv2.INTER_LINEAR,
                                   borderMode=cv2.BORDER_CONSTANT, borderValue=(14, 13, 16))
            vis = cv2.warpAffine(ann.visible, matrix, (view_w, view_h), flags=cv2.INTER_NEAREST,
                                borderMode=cv2.BORDER_CONSTANT, borderValue=255)
            sha = cv2.warpAffine(ann.shadow, matrix, (view_w, view_h), flags=cv2.INTER_NEAREST)
            # Visible mask omitted areas tinted red; shadow tinted blue.
            hidden = vis < 128
            shad = (sha > 128) & ~hidden
            if np.any(hidden):
                frame[hidden] = (frame[hidden].astype(np.float32) * .55 + np.array([20, 20, 125]) * .45).astype(np.uint8)
            if np.any(shad):
                frame[shad] = (frame[shad].astype(np.float32) * .7 + np.array([210, 140, 10]) * .3).astype(np.uint8)
            for contour, color in ((ann.iris, (0, 220, 255)), (ann.pupil, (255, 190, 30))):
                if contour is not None:
                    theta = np.linspace(0, 2*np.pi, 256, endpoint=False, dtype=np.float32)
                    bx, by = contour.points(theta)
                    pts = np.stack([bx*scale+ox,by*scale+oy],axis=-1).astype(np.int32)
                    cv2.polylines(frame,[pts],True,color,2,cv2.LINE_AA)
                    cv2.circle(frame,(round(contour.cx*scale+ox),round(contour.cy*scale+oy)),3,color,-1)
                    if contour.control_points:
                        for x0,y0 in contour.control_points:
                            cv2.circle(frame,(round(x0*scale+ox),round(y0*scale+oy)),3,color,-1)
            if outline_center:
                x0,y0 = outline_center
                screen_center=(round(x0*scale+ox),round(y0*scale+oy))
                cv2.circle(frame,screen_center,5,(50,245,240),-1)
                for idx,(bx,by) in enumerate(outline_points):
                    dest=(round(bx*scale+ox),round(by*scale+oy))
                    cv2.line(frame,screen_center,dest,(120,180,170),1,cv2.LINE_AA)
                    cv2.circle(frame,dest,5,(0,220,255) if mode=='o' else (255,190,30),-1)
                    cv2.putText(frame,str(idx+1),(dest[0]+6,dest[1]-6),cv2.FONT_HERSHEY_SIMPLEX,.35,(240,240,250),1)
                if len(outline_points)>=5:
                    try:
                        ghost=Ellipse.from_control_points(x0,y0,outline_points)
                        th=np.linspace(0,2*np.pi,256,endpoint=False)
                        gx,gy=ghost.points(th)
                        pp=np.stack([gx*scale+ox,gy*scale+oy],axis=-1).astype(np.int32)
                        cv2.polylines(frame,[pp],True,(20,250,140),1,cv2.LINE_AA)
                    except ValueError:
                        pass
            if polygon:
                pts = np.asarray([(int(x * scale + ox), int(y * scale + oy)) for x, y in polygon], np.int32)
                cv2.polylines(frame, [pts], False, (0, 120, 255) if mode == 'X' else (255, 200, 10), 2)
                for pt in pts:
                    cv2.circle(frame, tuple(pt), 3, (255, 255, 255), -1)
            if center:
                cv2.circle(frame, (int(center[0] * scale + ox), int(center[1] * scale + oy)), 4, (60, 255, 240), -1)
            if show_help:
                cv2.rectangle(frame, (0, 0), (view_w, 146), (9, 12, 20), -1)
                rows = [
                    f'MODE {mode}  zoom {zoom:.1f}x  brush {brush}px  |  o = POINT OUTER IRIS, k = POINT PUPIL',
                    'o/k: CLICK CENTRE, then 8-24 rim points around 360 degrees, C = confirm shape',
                    'p/i = simple 2-click circles | x=EXCLUDE lash/skin | v=restore | s=SHADOW | n=erase',
                    'X = polygon exclude | S = polygon shadow | C close polygon | Backspace remove point',
                    '[ / ] brush | wheel zoom | arrows pan | u undo mask | g help',
                    'ENTER EXPORT | ESC cancel | RED occluded  BLUE shadow | avoid real eyelashes as donors',
                ]
                for k, txt in enumerate(rows):
                    cv2.putText(frame, txt, (10, 18 + k * 21), cv2.FONT_HERSHEY_SIMPLEX,
                                min(.49, view_w/1800), (220, 245, 245), 1, cv2.LINE_AA)
            cv2.imshow(win, frame)
            k = cv2.waitKeyEx(30)
            if k in (ord('p'), ord('i'), ord('o'), ord('k'), ord('x'), ord('v'), ord('s'), ord('n'), ord('X'), ord('S')):
                mode = chr(k)
                center = None
                polygon = []
                outline_center = None
                outline_points = []
            elif k in (ord('c'), ord('C')) and mode in ('o', 'k'):
                if outline_center is None or len(outline_points)<5:
                    print('[EDITOR] Point contour: click center, then at least 5 edge points before C')
                else:
                    try:
                        shape=Ellipse.from_control_points(*outline_center,outline_points)
                        shape._polar_controls()
                        setattr(ann,'iris' if mode=='o' else 'pupil',shape)
                        outline_center=None
                        outline_points=[]
                        print('[EDITOR] Point contour saved; now mark eyelashes/skin with X')
                    except ValueError as exc:
                        print(f'[EDITOR] Invalid point contour: {exc}')
            elif k in (ord('c'), ord('C')) and mode in ('X', 'S'):
                if len(polygon) >= 3:
                    remember()
                    cv2.fillPoly(ann.visible if mode == 'X' else ann.shadow,
                                 [np.asarray(polygon, np.int32)], 0 if mode == 'X' else 255)
                polygon = []
            elif k in (8, 127) and outline_points:
                outline_points.pop()
            elif k in (8, 127) and polygon:
                polygon.pop()
            elif k in (ord('u'), ord('U')) and undo_stack:
                ann.visible, ann.shadow = undo_stack.pop()
            elif k in (ord('g'), ord('G')):
                show_help = not show_help
            elif k in (ord('['), ord('{')):
                brush = max(1, int(brush / 1.3))
            elif k in (ord(']'), ord('}')):
                brush = min(max(w, h), int(brush * 1.3) + 1)
            elif k in (ord('+'), ord('=')):
                zoom = min(12, zoom * 1.3)
            elif k in (ord('-'), ord('_')):
                zoom = max(1, zoom / 1.3)
            elif k in (2424832, 81):
                panx -= 60 / (fit * zoom)
            elif k in (2555904, 83):
                panx += 60 / (fit * zoom)
            elif k in (2490368, 82):
                pany -= 60 / (fit * zoom)
            elif k in (2621440, 84):
                pany += 60 / (fit * zoom)
            elif k in (10, 13):
                if polygon or (outline_center is not None):
                    print('[EDITOR] Press C to finish current points/polygon before Enter')
                elif ann.pupil and ann.iris:
                    return ann
                else:
                    print('[EDITOR] Set pupil with P and iris with I first')
            elif k == 27:
                raise KeyboardInterrupt('Manual annotation cancelled')
            if cv2.getWindowProperty(win, cv2.WND_PROP_VISIBLE) < 1:
                raise KeyboardInterrupt('Annotation window closed')
    except cv2.error as exc:
        raise RuntimeError('OpenCV GUI unavailable. Install opencv-python (not opencv-python-headless).') from exc
    finally:
        try:
            cv2.destroyWindow(win)
        except cv2.error:
            pass
