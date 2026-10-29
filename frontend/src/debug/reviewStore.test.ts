import { describe, it, expect } from 'vitest'
import { validateDraft, isAllowedRequest } from '../../dev-review-store'

describe('review storage boundary', () => {
  it('rejects cross-origin and non-loopback writes', () => {
    expect(isAllowedRequest('127.0.0.1', 'http://127.0.0.1:5173', '127.0.0.1:5173')).toBe(true)
    expect(isAllowedRequest('192.168.1.4', 'http://127.0.0.1:5173', '127.0.0.1:5173')).toBe(false)
    expect(isAllowedRequest('127.0.0.1', 'http://evil.example', '127.0.0.1:5173')).toBe(false)
    expect(isAllowedRequest('127.0.0.1', undefined, '127.0.0.1:5173')).toBe(false)
  })
  it('rejects path manipulation, empty text and invalid images', () => {
    expect(() => validateDraft({ sceneId: '../outside', text: 'x' }, '')).toThrow()
    expect(() => validateDraft({ sceneId: 'identity', text: ' ' }, '')).toThrow()
    expect(() => validateDraft({ sceneId: 'identity', text: 'x' }, 'not image')).toThrow()
  })
})
