// Node built-ins run only in Vitest's Node environment; app tsconfig intentionally omits @types/node.
// @ts-expect-error Vitest executes this asset regression in Node.
import { createHash } from 'node:crypto'
// @ts-expect-error Vitest executes this asset regression in Node.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('identity photo asset', () => {
  it('preserves the exact monochrome runtime photo and original source copy', () => {
    const hash = (path: URL) => createHash('sha256').update(readFileSync(path)).digest('hex').toUpperCase()
    const runtimePhoto = new URL('../../assets/start_img.jpg', import.meta.url)
    const originalPhoto = new URL('../../../../images/start_img.jpg', import.meta.url)
    const expected = 'BEFAD4FD1F270558EEAB25113BB169ED25479CE7B7CB3DB7812FDCE29124D899'
    expect(hash(runtimePhoto)).toBe(expected)
    expect(hash(originalPhoto)).toBe(expected)
  })
})

describe('identity scene render wiring', () => {
  it('keeps removed name, spiral, spark and placeholder phases out of scene 04', () => {
    const source = readFileSync(new URL('../IdentityScene.tsx', import.meta.url), 'utf8') as string
    expect(source).not.toMatch(/from ['"].*\/(?:IdentityTrails|IdentityAtmosphere|identityVortex|identityName)/)
    expect(source).not.toMatch(/<\s*(?:Spark|PlaceholderCard)\b/)
    expect(source).not.toMatch(/\b(?:aSpiral|aName|nameScale|orbitGeometry|uNameScale)\b/)
  })
})
