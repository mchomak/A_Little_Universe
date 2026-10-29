import { useLayoutEffect, useRef } from 'react'
import { COPY } from '../engine/filmConfig'
import type { FilmRuntime } from '../engine/runtime'
import { firstMemoryFrame } from '../scenes/shared/firstMemoryFrame'
import { loadArtFont } from '../systems/scene-config/fontCatalog'

const random = (i: number) => { const n = Math.sin(i * 127.1 + 19.19) * 43758.5453; return n - Math.floor(n) }
type Shard = { sx: number; sy: number; x: number; y: number; seed: number }

/** A small deterministic remainder of the Georgia name strokes settles into the caption. */
export function FirstMemoryCaption({ runtime, gallery = false, reducedMotion }: {
  runtime: FilmRuntime; gallery?: boolean; reducedMotion: boolean
}) {
  const canvas = useRef<HTMLCanvasElement>(null), phrase = useRef<HTMLParagraphElement>(null), group = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const surface = canvas.current, text = phrase.current, container = group.current
    if (!surface || !text || !container) return
    const ctx = surface.getContext('2d')
    if (!ctx) {
      const render = (time: number) => {
        const opacity = firstMemoryFrame(gallery ? 34 : time, reducedMotion).caption
        text.style.opacity = String(opacity); text.setAttribute('aria-hidden', String(opacity === 0))
      }
      render(runtime.time)
      return runtime.subscribeFrame(render)
    }
    let active = true, width = 0, height = 0
    let shards: Shard[] = []
    const build = () => {
      width = container.clientWidth; height = container.clientHeight
      const ratio = Math.min(1.5, window.devicePixelRatio || 1)
      surface.width = Math.round(width * ratio); surface.height = Math.round(height * ratio)
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
      if (reducedMotion || gallery || !width || !height) { shards = []; return }
      const style = getComputedStyle(text), fontSize = parseFloat(style.fontSize)
      const mask = document.createElement('canvas'); mask.width = Math.ceil(width); mask.height = Math.ceil(height)
      const ink = mask.getContext('2d')!
      ink.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
      ink.fillStyle = 'white'; ink.textAlign = 'center'
      ink.fillText(COPY.photoCaption, width / 2, height - fontSize * .25)
      const pixels = ink.getImageData(0, 0, mask.width, mask.height).data, targets: number[] = []
      for (let y = 0; y < mask.height; y += 2) for (let x = 0; x < mask.width; x += 2) {
        if (pixels[(y * mask.width + x) * 4 + 3]! > 100) targets.push(x, y)
      }
      // Same word and Georgia face as the existing 04.3 name geometry. Only
      // a sparse residue is sampled, never another visible title/name reveal.
      mask.width = 600; mask.height = 90
      ink.font = 'bold 76px Georgia, serif'; ink.fillStyle = 'white'; ink.textAlign = 'center'
      ink.fillText('ВАСИЛИСА', 300, 76, 580)
      const name = ink.getImageData(0, 0, 600, 90).data, origins: number[] = []
      for (let y = 0; y < 90; y += 3) for (let x = 0; x < 600; x += 3) {
        if (name[(y * 600 + x) * 4 + 3]! > 100) origins.push(x, y)
      }
      shards = Array.from({ length: Math.min(360, targets.length / 2) }, (_, i) => {
        const target = Math.floor(random(i + 71) * targets.length / 2) * 2
        const source = Math.floor(random(i + 31) * origins.length / 2) * 2
        return { x: targets[target]!, y: targets[target + 1]!, seed: random(i),
          sx: width / 2 + ((origins[source] ?? 300) / 600 - .5) * Math.min(420, width * .65),
          sy: height * .28 + (origins[source + 1] ?? 45) / 90 * 28 + (random(i + 15) - .5) * 30 }
      })
    }
    const render = (time: number) => {
      const shot = gallery ? 34 : time, frame = firstMemoryFrame(shot, reducedMotion)
      text.style.opacity = String(frame.caption)
      text.setAttribute('aria-hidden', String(frame.caption === 0))
      ctx.clearRect(0, 0, width, height)
      if (!frame.particles) return
      for (const shard of shards) {
        const t = Math.max(0, Math.min(1, (frame.assembly - shard.seed * .1) / .9))
        const travel = t * t * (3 - 2 * t), arc = Math.sin(travel * Math.PI) * (1 - travel)
        const x = shard.sx + (shard.x - shard.sx) * travel + Math.sin(shard.seed * 30) * arc * 34
        const y = shard.sy + (shard.y - shard.sy) * travel - arc * 20
        ctx.fillStyle = `rgba(255,222,197,${frame.particles * (.25 + shard.seed * .45)})`
        ctx.beginPath(); ctx.arc(x, y, .65 + shard.seed * .65, 0, Math.PI * 2); ctx.fill()
      }
    }
    build(); render(runtime.time)
    const observer = new ResizeObserver(() => { build(); render(runtime.time) })
    observer.observe(container)
    const unsubscribe = runtime.subscribeFrame(render)
    void loadArtFont('cormorant-garamond').then(() => { if (active) { build(); render(runtime.time) } })
    return () => { active = false; observer.disconnect(); unsubscribe(); ctx.clearRect(0, 0, width, height) }
  }, [runtime, gallery, reducedMotion])
  return <div ref={group} className="first-memory-caption" aria-live="polite">
    <canvas ref={canvas} aria-hidden="true" />
    <p ref={phrase} className="first-memory-phrase" style={{ opacity: 0 }}>{COPY.photoCaption}</p>
  </div>
}
