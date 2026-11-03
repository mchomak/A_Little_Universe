import image1 from '../../assets/gallery-placeholders/02-cafe-portrait.webp'
import image2 from '../../assets/gallery-placeholders/03-shore-friends.webp'
import image3 from '../../assets/gallery-placeholders/04-coastal-village.webp'
import image4 from '../../assets/gallery-placeholders/05-city-portrait.webp'
import image5 from '../../assets/gallery-placeholders/06-mountain-lake.webp'
import image6 from '../../assets/gallery-placeholders/07-coffee.webp'
import image7 from '../../assets/gallery-placeholders/08-rainy-city.webp'
import image8 from '../../assets/gallery-placeholders/09-picnic.webp'
import image9 from '../../assets/gallery-placeholders/10-meadow.webp'
import image10 from '../../assets/gallery-placeholders/11-window.webp'
import image11 from '../../assets/gallery-placeholders/12-stars.webp'
import photo from '../../assets/start_img.jpg'
export interface GalleryMemory { id: string; image: string | undefined; caption: string; aspect: number; side: -1 | 1; order: number; palette: [string, string] }
const images = [image1, image2, image3, image4, image5, image6, image7, image8, image9, image10, image11]
const captions = ['С этого всё началось', 'Портрет · пример', 'Вместе · пример', 'Путешествие · пример', 'Город · пример', 'Пейзаж · пример', 'Встреча · пример', 'Дорога · пример', 'Тёплый вечер · пример', 'Место · пример', 'Момент · пример', 'А помнишь, как мы смотрели на звёзды?']
const palettes: [string, string][] = [['#765c68','#c59e8c'],['#7b5267','#e1ad91'],['#84655c','#d6a685'],['#3d6975','#d5ae87'],['#555a75','#e1a78d'],['#476d71','#a3b3a1'],['#805d67','#e1b394'],['#5b7486','#c4a28d'],['#7c5260','#d99e82'],['#4e657b','#d7a58e'],['#6c656d','#d5b59d'],['#223750','#967fa2']]
export const GALLERY_MEMORIES: GalleryMemory[] = captions.map((caption, order) => ({ id: `memory-${order + 1}`, image: order === 0 ? photo : images[order - 1], caption, order, side: order % 2 === 0 ? -1 : 1, aspect: [1, .72, 1.36, 1.4, .75, 1.3, 1, 1.4, .76, 1.25, 1, 1.4][order] ?? 1, palette: palettes[order % palettes.length]! }))
export const GALLERY = { spacing: 5.4, width: 7, firstZ: -4.5, startZ: 6.15, travel: 6.15 + 4.5 + (GALLERY_MEMORIES.length - 1) * 5.4 + 4, intro: 4.4, exit: 3.2, sensitivity: .045 } as const
/** The single photo placement rule: aisle width changes only symmetric X; depth/order remain fixed. */
export function memoryPosition(memory: GalleryMemory, galleryWidth: number): [number, number, number] {
  const halfWidth = Number.isFinite(galleryWidth) ? Math.max(0, galleryWidth) / 2 : GALLERY.width / 2
  return [memory.side * halfWidth, 0, GALLERY.firstZ - memory.order * GALLERY.spacing]
}
