export const GALLERY_CAPTION_PLANE_WIDTH = 3.4
export const GALLERY_CAPTION_GAP = 0.34
export const GALLERY_CAPTION_CANVAS_WIDTH = 1024
export const GALLERY_CAPTION_HORIZONTAL_PADDING = 72
export const GALLERY_CAPTION_VERTICAL_PADDING = 16
export const GALLERY_CAPTION_TITLE_FONT_SIZE = 25
export const GALLERY_CAPTION_TITLE_LINE_HEIGHT = 32
export const GALLERY_CAPTION_BODY_FONT_SIZE = 29
export const GALLERY_CAPTION_BODY_LINE_HEIGHT = 38
export const GALLERY_CAPTION_SECTION_GAP = 10

const TITLE_MAX_CHARACTERS = 56
const CAPTION_MAX_CHARACTERS = 62
const layouts = new Map<string, GalleryCaptionLayout>()

export interface GalleryCaptionLayout {
  titleLines: readonly string[]
  captionLines: readonly string[]
  canvasHeight: number
  worldHeight: number
}

function wrapText(text: string, maxCharacters: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    if (line && line.length + 1 + word.length > maxCharacters) {
      lines.push(line)
      line = ''
    }
    if (word.length <= maxCharacters) {
      line = line ? `${line} ${word}` : word
      continue
    }
    for (let start = 0; start < word.length; start += maxCharacters) {
      const part = word.slice(start, start + maxCharacters)
      if (line) lines.push(line)
      line = part
      if (part.length === maxCharacters) {
        lines.push(line)
        line = ''
      }
    }
  }
  if (line) lines.push(line)
  return lines
}

/** Uses the same stable line breaks for the canvas texture and the focused camera bounds. */
export function getGalleryCaptionLayout(title: string, caption: string): GalleryCaptionLayout {
  const cacheKey = `${title}\u0000${caption}`
  const cached = layouts.get(cacheKey)
  if (cached) return cached

  const titleLines = wrapText(title, TITLE_MAX_CHARACTERS)
  const captionLines = wrapText(caption, CAPTION_MAX_CHARACTERS)
  const textHeight = titleLines.length * GALLERY_CAPTION_TITLE_LINE_HEIGHT
    + captionLines.length * GALLERY_CAPTION_BODY_LINE_HEIGHT
    + (titleLines.length && captionLines.length ? GALLERY_CAPTION_SECTION_GAP : 0)
  const canvasHeight = textHeight > 0
    ? textHeight + GALLERY_CAPTION_VERTICAL_PADDING * 2
    : 0
  const layout = {
    titleLines,
    captionLines,
    canvasHeight,
    worldHeight: canvasHeight * GALLERY_CAPTION_PLANE_WIDTH / GALLERY_CAPTION_CANVAS_WIDTH,
  }
  layouts.set(cacheKey, layout)
  return layout
}
