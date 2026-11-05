import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { PhoneBackground } from './PhoneBackground'

it('keeps the shared background unchanged at Scene 02 entry and leaves fall motion to runtime', () => {
  const growth = renderToStaticMarkup(createElement(PhoneBackground, { scene: 'growth' }))
  const bloom = renderToStaticMarkup(createElement(PhoneBackground, { scene: 'bloom' }))
  const reducedMotionGrowth = renderToStaticMarkup(createElement(PhoneBackground, { scene: 'growth', reducedMotion: true }))

  expect(growth).toContain('filter:none')
  expect(growth).toContain('transition:none')
  expect(bloom).toContain('filter:none')
  expect(reducedMotionGrowth).toContain('transition:none')
})
