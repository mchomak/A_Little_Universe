import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { PhoneBackground } from './PhoneBackground'

it('softens the cosmic image only in Scene 02 and respects reduced motion', () => {
  const growth = renderToStaticMarkup(createElement(PhoneBackground, { scene: 'growth' }))
  const bloom = renderToStaticMarkup(createElement(PhoneBackground, { scene: 'bloom' }))
  const reducedMotionGrowth = renderToStaticMarkup(createElement(PhoneBackground, { scene: 'growth', reducedMotion: true }))

  expect(growth).toContain('filter:brightness(0.48) saturate(0.72)')
  expect(growth).toContain('transition:filter 700ms ease-in-out')
  expect(bloom).toContain('filter:none')
  expect(reducedMotionGrowth).toContain('transition:none')
})
