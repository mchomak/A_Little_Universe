import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { PhoneBackground } from './PhoneBackground'

it('keeps the same unfiltered cosmic crop through seed formation', () => {
  const prologue = renderToStaticMarkup(createElement(PhoneBackground, { scene: 'prologue' }))
  const growth = renderToStaticMarkup(createElement(PhoneBackground, { scene: 'growth' }))
  const bloom = renderToStaticMarkup(createElement(PhoneBackground, { scene: 'bloom' }))
  const initialCrop = 'transform:translate(0%, var(--background-pan-y, 0%)) scale(1.8)'

  expect(prologue).toContain(initialCrop)
  expect(growth).toContain(initialCrop)
  expect(bloom).toContain(initialCrop)
  expect(growth).not.toContain('filter:')
})
