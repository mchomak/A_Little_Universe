import { useSyncExternalStore } from 'react'
import { galleryExit, galleryFocus, gallerySnapshot, galleryStart, subscribeGallery, travel } from '../scenes/gallery/controller'
import { GALLERY_MEMORIES } from '../scenes/gallery/content'
import './gallery.css'
export function GalleryOverlay({ paused }: { paused: boolean }) {
  const { phase, focus, atEnd } = useSyncExternalStore(subscribeGallery, gallerySnapshot, gallerySnapshot)
  if (phase === 'instruction') return <section className="gallery-intro" aria-label="Как исследовать галерею"><div className="gallery-intro-inner"><span className="gallery-intro-star">✦</span><h1>Давай вспомним кое-что…</h1><p>Приближай фотографии и двигайся вперёд</p><div className="gallery-gestures"><div><span>↗ &nbsp; ↖</span>Разводи пальцы — двигайся вперёд</div><div><span>↙ &nbsp; ↘</span>Своди пальцы — возвращайся назад</div><div><span>✧</span>Коснись фотографии — рассмотри её</div><div><span>↶</span>Коснись ещё раз — вернись к прогулке</div></div><button type="button" disabled={paused} onClick={galleryStart}>Начать прогулку</button></div></section>
  if (phase !== 'explore') return null
  return <div className="gallery-navigation" aria-label="Управление галереей"><label className="gallery-accessible">Выбрать фотографию<select aria-label="Выбрать фотографию" disabled={paused} value={focus ?? ''} onChange={(event) => galleryFocus(event.target.value === '' ? null : Number(event.target.value))}><option value="">Прогулка</option>{GALLERY_MEMORIES.map(memory => <option key={memory.id} value={memory.order}>{memory.caption}</option>)}</select></label><div className="gallery-move"><button type="button" disabled={paused || focus !== null} onClick={() => travel(-5)} aria-label="Двигаться назад">←</button><button type="button" disabled={paused || focus !== null} onClick={() => travel(5)} aria-label="Двигаться вперёд">→</button></div>{focus !== null && <button type="button" disabled={paused} onClick={() => galleryFocus(null)}>Вернуться к прогулке</button>}{atEnd && focus === null && <button type="button" disabled={paused} onClick={galleryExit}>Продолжить</button>}</div>
}

