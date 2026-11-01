import { createHash } from 'node:crypto'
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
