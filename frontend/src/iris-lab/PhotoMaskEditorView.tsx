import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { BlueEyeSettings } from './config'
import { irisMaskHandles, moveIrisMaskHandle, type IrisMaskHandle, type IrisMaskHandleSet, type IrisMaskName, type NormalizedPoint } from './irisMaskMath'

type ImageSize = { width: number; height: number }

/** A small source-photo overlay for direct iris and pupil mask calibration. */
export function IrisMaskEditor({ source, settings, onChange }: {
  source: string | null
  settings: BlueEyeSettings
  onChange: (settings: BlueEyeSettings) => void
}) {
  const svg = useRef<SVGSVGElement>(null)
  const [size, setSize] = useState<ImageSize | null>(null)
  const [dragging, setDragging] = useState<IrisMaskHandle | null>(null)
  const imageWidth = size?.width ?? 1
  const imageHeight = size?.height ?? 1
  const iris = irisMaskHandles(settings, 'iris')
  const pupil = irisMaskHandles(settings, 'pupil')
  const pointFromEvent = (event: PointerEvent<SVGSVGElement>): NormalizedPoint => {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height }
  }
  const startDrag = (handle: IrisMaskHandle) => (event: PointerEvent<SVGCircleElement>) => {
    event.preventDefault()
    event.stopPropagation()
    svg.current?.setPointerCapture(event.pointerId)
    setDragging(handle)
  }
  const movePointer = (event: PointerEvent<SVGSVGElement>) => {
    if (!dragging) return
    event.preventDefault()
    onChange(moveIrisMaskHandle(settings, dragging, pointFromEvent(event)))
  }
  const moveKeyboard = (handle: IrisMaskHandle) => (event: KeyboardEvent<SVGCircleElement>) => {
    const step = event.shiftKey ? 0.01 : 0.002
    const delta = { x: event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0, y: event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0 }
    if (!delta.x && !delta.y) return
    event.preventDefault()
    const handles = handle.startsWith('iris-') ? iris as Record<IrisMaskHandle, NormalizedPoint> : pupil as Record<IrisMaskHandle, NormalizedPoint>
    const current = handles[handle]
    const next = { x: current.x + delta.x, y: current.y + delta.y }
    onChange(moveIrisMaskHandle(settings, handle, next))
  }

  if (!source) return <div className="iris-mask-editor-empty">Load an eye photo to calibrate its iris and pupil.</div>

  const handleCircle = (handle: IrisMaskHandle, point: NormalizedPoint, label: string, color: string, radius = Math.min(imageWidth, imageHeight) * 0.014) => <circle
    key={handle}
    cx={point.x * imageWidth}
    cy={point.y * imageHeight}
    r={radius}
    fill={color}
    stroke="#071116"
    strokeWidth={Math.min(imageWidth, imageHeight) * 0.004}
    role="slider"
    aria-label={label}
    aria-valuetext={`${(point.x * 100).toFixed(1)}%, ${(point.y * 100).toFixed(1)}%`}
    tabIndex={0}
    onPointerDown={startDrag(handle)}
    onKeyDown={moveKeyboard(handle)}
  />

  const drawMask = <Name extends IrisMaskName>(name: Name, handles: IrisMaskHandleSet<Name>, color: string) => {
    const center = handles[`${name}-center`]
    const radiusX = name === 'iris' ? settings.irisRadiusX : settings.pupilRadiusX
    const radiusY = name === 'iris' ? settings.irisRadiusY : settings.pupilRadiusY
    const rotation = name === 'iris' ? settings.irisRotation : settings.pupilRotation
    const cx = center.x * imageWidth, cy = center.y * imageHeight
    const rx = radiusX * imageWidth, ry = radiusY * imageHeight
    return <g key={name} className={`iris-mask-outline iris-mask-outline-${name}`}>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} transform={`rotate(${rotation * 180 / Math.PI} ${cx} ${cy})`} fill={color} fillOpacity="0.07" stroke={color} strokeWidth={Math.min(imageWidth, imageHeight) * 0.003} strokeDasharray={name === 'pupil' ? '10 8' : undefined} />
      {handleCircle(`${name}-center`, handles[`${name}-center`], `${name === 'iris' ? 'Iris' : 'Pupil'} center — drag to move`, color, Math.min(imageWidth, imageHeight) * 0.011)}
      {handleCircle(`${name}-radius-x`, handles[`${name}-radius-x`], `${name === 'iris' ? 'Iris' : 'Pupil'} horizontal radius — drag to resize`, color)}
      {handleCircle(`${name}-radius-y`, handles[`${name}-radius-y`], `${name === 'iris' ? 'Iris' : 'Pupil'} vertical radius — drag to resize`, color)}
    </g>
  }

  return <div className="iris-mask-editor-wrap">
    <div className="iris-mask-editor-heading"><strong>Drag the photo masks</strong><span>center + horizontal / vertical radius</span></div>
    <div className="iris-mask-editor" style={{ aspectRatio: `${imageWidth} / ${imageHeight}` }}>
      <img src={source} alt="Source eye photo for iris mask calibration" draggable={false} onLoad={(event) => setSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} />
      <svg ref={svg} viewBox={`0 0 ${imageWidth} ${imageHeight}`} preserveAspectRatio="none" role="group" aria-label="Interactive iris and pupil masks" onPointerMove={movePointer} onPointerUp={() => setDragging(null)} onPointerCancel={() => setDragging(null)}>
        {drawMask('iris', iris, '#35cfff')}
        {drawMask('pupil', pupil, '#e8f5ff')}
      </svg>
    </div>
    <div className="iris-mask-legend"><span><i className="iris-mask-swatch iris-mask-swatch-iris" />Iris boundary</span><span><i className="iris-mask-swatch iris-mask-swatch-pupil" />Pupil boundary</span></div>
  </div>
}
