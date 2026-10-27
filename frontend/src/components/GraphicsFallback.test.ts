import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { GraphicsFallback } from './GraphicsFallback'

it('keeps the fallback readable and announced when WebGL fails', () => {
  const markup = renderToStaticMarkup(createElement(GraphicsFallback))

  expect(markup).toContain('role="alert"')
  expect(markup).toContain('3D-сцена недоступна')
  expect(markup).toContain('Перезагрузить')
})

it('hides the canvas fallback from accessibility after WebGL initializes', () => {
  const markup = renderToStaticMarkup(createElement(GraphicsFallback, { hidden: true }))

  expect(markup).toContain('aria-hidden="true"')
  expect(markup).not.toContain('role="alert"')
})
