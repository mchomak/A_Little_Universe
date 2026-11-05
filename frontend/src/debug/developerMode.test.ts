import { describe, expect, it } from 'vitest'
import { isDeveloperMode } from './developerMode'

describe('desktop developer panel access', () => {
  it('keeps the DEV tools available inside the packaged desktop application', () => {
    expect(isDeveloperMode(false, new URL('app://bundle/index.html'))).toBe(true)
  })

  it('keeps production preview access opt-in', () => {
    expect(isDeveloperMode(false, new URL('http://localhost:4173/'))).toBe(false)
    expect(isDeveloperMode(false, new URL('http://localhost:4173/?debug'))).toBe(true)
    expect(isDeveloperMode(false, new URL('https://film.example/?debug'))).toBe(false)
  })
})
