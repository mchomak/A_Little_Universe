import { describe, expect, it } from 'vitest'
import { getImplementationStatus } from './filmStatus'

describe('film implementation status', () => {
  it('identifies scene 02 seed formation as implemented', () => {
    expect(getImplementationStatus('growth')).toBe('Сцена 02 · семечко и рост лилии')
  })

  it('identifies the lily reveal and only lists scenes that remain placeholders', () => {
    expect(getImplementationStatus('bloom')).toBe('Сцена 03 · раскрытие лилии')
    expect(getImplementationStatus('identity')).toBe('Сцена 04 · растворение лилии')
  })
})
