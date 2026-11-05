import { describe, expect, it } from 'vitest'
import { getGalleryCaptionLayout } from './captionLayout'

describe('gallery caption layout', () => {
  it('renders titles in uppercase and scales both title and body with the configured size', () => {
    const standard = getGalleryCaptionLayout('Поездка в Тулу — май 2026', 'Короткая подпись.', 29)
    const larger = getGalleryCaptionLayout('Поездка в Тулу — май 2026', 'Короткая подпись.', 40)

    expect(standard.titleLines).toEqual(['ПОЕЗДКА В ТУЛУ — МАЙ 2026'])
    expect(standard.bodyFontSize).toBe(29)
    expect(larger.bodyFontSize).toBe(40)
    expect(larger.titleFontSize).toBeGreaterThan(standard.titleFontSize)
    expect(larger.canvasHeight).toBeGreaterThan(standard.canvasHeight)
  })
})
