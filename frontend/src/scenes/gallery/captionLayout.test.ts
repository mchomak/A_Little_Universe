import { describe, expect, it } from 'vitest'
import { getGalleryCaptionLayout } from './captionLayout'

describe('gallery caption layout', () => {
  it('renders readable titles and scales both title and body with the configured size', () => {
    const standard = getGalleryCaptionLayout('Поездка в Тулу — май 2026', 'Короткая подпись.', 29)
    const larger = getGalleryCaptionLayout('Поездка в Тулу — май 2026', 'Короткая подпись.', 40)

    expect(standard.titleLines).toEqual(['Поездка в Тулу — май 2026'])
    expect(standard.bodyFontSize).toBe(29)
    expect(larger.bodyFontSize).toBe(40)
    expect(larger.titleFontSize).toBeGreaterThan(standard.titleFontSize)
    expect(larger.canvasHeight).toBeGreaterThan(standard.canvasHeight)
  })
  it('changes wrapping and camera dimensions consistently with the selected width', () => {
    const text = 'Один хороший день, который мы запомним надолго. '.repeat(5)
    const narrow = getGalleryCaptionLayout('Заголовок', text, 60, 25)
    const wide = getGalleryCaptionLayout('Заголовок', text, 60, 70)
    expect(narrow.captionLines.length).toBeGreaterThan(wide.captionLines.length)
    expect(narrow.worldWidth).toBeLessThan(wide.worldWidth)
    expect(narrow.worldHeight).toBeGreaterThan(wide.worldHeight)
    expect(wide.bodyFontSize).toBe(60)
  })
})
