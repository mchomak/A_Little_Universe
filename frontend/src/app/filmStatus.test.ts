import { describe, expect, it } from 'vitest'
import { getImplementationStatus } from './filmStatus'

describe('film implementation status', () => {
  it('identifies scene 02 seed formation as implemented', () => {
    expect(getImplementationStatus('growth')).toBe('Сцена 02 · формирование семечка')
  })

  it('lists only the scenes that remain placeholders', () => {
    expect(getImplementationStatus('bloom')).toBe('Сцены 03, 06–09 · placeholders')
  })
})
