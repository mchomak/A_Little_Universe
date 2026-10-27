import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { getConfig, updateConfig } from '../systems/scene-config/config'
import { PersistentLight } from './PersistentLight'

it('owns config-backed glow and pulse styles and disables the pulse for reduced motion', async () => {
  const initial = getConfig().scenes.prologue
  await updateConfig({ scenes: { prologue: { glow: 1.5, pulseAmplitude: 0.12, pulseFrequency: 2 } } })
  try {
    const markup = renderToStaticMarkup(createElement(PersistentLight, { phase: 'prologue' }))
    const reducedMarkup = renderToStaticMarkup(createElement(PersistentLight, { phase: 'prologue', reducedMotion: true }))

    expect(markup).toContain('prologue-light-pulse 0.5s')
    expect(markup).toContain('scale(0.88)')
    expect(markup).toContain('scale(1.12)')
    expect(markup).toContain('0 0 10.5px')
    expect(reducedMarkup).toContain('animation: none !important')
    expect(reducedMarkup).not.toContain('prologue-light-pulse 0.5s')

    await updateConfig({ scenes: { prologue: { pulseAmplitude: 0 } } })
    const flatMarkup = renderToStaticMarkup(createElement(PersistentLight, { phase: 'prologue' }))
    const lowFrame = flatMarkup.match(/0%, 100% \{([^}]*)\}/)?.[1] ?? ''
    const highFrame = flatMarkup.match(/50% \{([^}]*)\}/)?.[1] ?? ''
    const blurs = (frame: string) => Array.from(frame.matchAll(/box-shadow: 0 0 ([\d.]+)px/g), (match) => match[1])
    expect(blurs(lowFrame)).toEqual(blurs(highFrame))
  } finally {
    await updateConfig({ scenes: { prologue: {
      glow: initial.glow, pulseAmplitude: initial.pulseAmplitude, pulseFrequency: initial.pulseFrequency,
    } } })
  }
})
