export const SUPPORTED_GALLERY_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'avif'] as const

export const GALLERY_EVENT_ORDER = [
  '2024_00_Dimas_Birthday',
  '2025_01_Moscow_City_New_Year',
  '2026_01_Country_House_New_Year',
  '2026_02_My_Birthday',
  '2026_02_23_February_23',
  '2026_00_After_Gym',
  '2026_00_Movie_Night',
  '2026_04_Theater_Night',
  '2026_04_Artems_Birthday',
  '2026_05_Annas_Graduation',
  '2026_05_Tula_Trip',
  '2026_05_Tula_Karting',
  '2026_06_Visiting_Anna',
  '2026_00_World_Cup',
  '2026_00_Club_Night',
  '2026_08_Asia_Trip',
  '2026_08_Koh_Samui',
  '2026_00_Timurs_Farewell',
  '2026_09_Annas_Birthday',
  '2026_10_Saint_Petersburg',
  '2026_10_Planetarium',
] as const

export interface GalleryCatalogMemory {
  id: string
  image: string | undefined
  images: Array<string | undefined>
  caption: string
  aspect: number
  side: -1 | 1
  order: number
  palette: [string, string]
}

type Captions = Readonly<Record<string, { caption: string } | undefined>>
type Palette = [string, string]

const byStableName = (left: string, right: string) => {
  const leftParts = left.toLocaleLowerCase('en').match(/\d+|\D+/g) ?? []
  const rightParts = right.toLocaleLowerCase('en').match(/\d+|\D+/g) ?? []
  const partCount = Math.min(leftParts.length, rightParts.length)
  for (let index = 0; index < partCount; index += 1) {
    const leftPart = leftParts[index]!
    const rightPart = rightParts[index]!
    const leftIsNumber = /^\d+$/.test(leftPart)
    const rightIsNumber = /^\d+$/.test(rightPart)
    if (leftIsNumber && rightIsNumber) {
      const difference = Number(leftPart) - Number(rightPart)
      if (difference !== 0) return difference
      if (leftPart.length !== rightPart.length) return leftPart.length - rightPart.length
    } else if (leftPart !== rightPart) {
      return leftPart < rightPart ? -1 : 1
    }
  }
  if (leftParts.length !== rightParts.length) return leftParts.length - rightParts.length
  return left < right ? -1 : left > right ? 1 : 0
}

function eventFileParts(path: string): { eventId: string; fileName: string } | undefined {
  const segments = path.replaceAll('\\', '/').split('/')
  const imagesIndex = segments.lastIndexOf('images')
  if (imagesIndex < 0 || imagesIndex + 2 !== segments.length - 1) return undefined
  return { eventId: segments[imagesIndex + 1]!, fileName: segments[imagesIndex + 2]! }
}

function placePhotos(files: readonly { fileName: string; url: string }[]): Array<string | undefined> {
  const slots: Array<string | undefined> = [undefined, undefined, undefined, undefined]
  const unnumbered: typeof files[number][] = []
  const ordered = [...files].sort((left, right) => byStableName(left.fileName, right.fileName))
  for (const file of ordered) {
    const numbered = /^([1-4])\.(?:jpg|jpeg|png|webp|avif)$/i.exec(file.fileName)
    const slot = numbered ? Number(numbered[1]) - 1 : -1
    if (slot >= 0 && slots[slot] === undefined) slots[slot] = file.url
    else if (slot < 0) unnumbered.push(file)
  }
  for (const file of unnumbered) {
    const firstOpenSlot = slots.findIndex((entry) => entry === undefined)
    if (firstOpenSlot < 0) break
    slots[firstOpenSlot] = file.url
  }
  if (slots[0] === undefined) {
    const firstExistingSlot = slots.findIndex((entry) => entry !== undefined)
    if (firstExistingSlot > 0) {
      slots[0] = slots[firstExistingSlot]
      slots[firstExistingSlot] = undefined
    }
  }
  return slots
}

/** Builds an ordered catalogue from Vite's static asset glob, preserving numbered collage slots. */
export function createGalleryEventMemories(
  eventOrder: readonly string[],
  assets: Readonly<Record<string, string>>,
  captions: Captions,
  palettes: readonly Palette[],
  placeholderEvents: readonly string[] = [],
): GalleryCatalogMemory[] {
  const filesByEvent = new Map<string, { fileName: string; url: string }[]>()
  for (const [path, url] of Object.entries(assets)) {
    const parts = eventFileParts(path)
    if (!parts || !SUPPORTED_GALLERY_IMAGE_EXTENSIONS.some((ext) => parts.fileName.toLowerCase().endsWith(`.${ext}`))) continue
    const files = filesByEvent.get(parts.eventId) ?? []
    files.push({ fileName: parts.fileName, url })
    filesByEvent.set(parts.eventId, files)
  }

  const placeholderEventSet = new Set(placeholderEvents)
  const memories: GalleryCatalogMemory[] = []
  for (const eventId of eventOrder) {
    const files = filesByEvent.get(eventId)
    if (!files?.length && !placeholderEventSet.has(eventId)) continue
    const images = files?.length ? placePhotos(files) : [undefined, undefined, undefined, undefined]
    const image = images[0]
    if (files?.length && !image) continue
    const order = memories.length
    memories.push({
      id: eventId,
      image,
      images,
      caption: captions[eventId]?.caption ?? '',
      aspect: 1,
      side: order % 2 === 0 ? -1 : 1,
      order,
      palette: palettes[order % Math.max(1, palettes.length)] ?? ['#765c68', '#c59e8c'],
    })
  }
  return memories
}
