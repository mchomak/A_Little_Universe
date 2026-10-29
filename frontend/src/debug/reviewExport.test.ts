import { describe, it, expect } from 'vitest'
import { buildReviewMarkdown } from '../../dev-review-export'

describe('Codex review export', () => {
  it('groups selected notes by scene and frame and retains truthful checkpoints and paths', () => {
    const markdown = buildReviewMarkdown([{ id: '12345678-1234-1234-1234-123456789abc', sceneId: 'identity', frameId: '04.3 Имя', localTimeSeconds: 12.3, capturedMode: 'playing', checkpoint: { reading: false }, text: 'Исправить свет', priority: 'high', status: 'open', viewport: { width: 1024, height: 768, dpr: 2 }, screenshotPath: 'scene-04/screenshots/12345678-1234-1234-1234-123456789abc.png', config: { global: { quality: 'low' } } }])
    expect(markdown).toContain('## identity')
    expect(markdown).toContain('### 04.3 Имя')
    expect(markdown).toContain('12.3')
    expect(markdown).toContain('scene-04/screenshots/12345678-1234-1234-1234-123456789abc.png')
    expect(markdown).toContain('Исправить свет')
    expect(markdown).toContain('quality')
  })
})
