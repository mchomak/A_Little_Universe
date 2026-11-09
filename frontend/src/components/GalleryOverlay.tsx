import { useSyncExternalStore } from 'react'
import { galleryExit, galleryFocus, gallerySnapshot, galleryStart, subscribeGallery, travel } from '../scenes/gallery/controller'
import { GALLERY_MEMORIES } from '../scenes/gallery/content'
import './gallery.css'

type GalleryGuideIconName = 'movement' | 'photo' | 'return' | 'arch'

function GalleryGuideIcon({ name, touch = false }: { name: GalleryGuideIconName; touch?: boolean }) {
  const className = `gallery-guide-icon${touch ? ' gallery-guide-icon--touch' : ''}${name === 'movement' ? ' gallery-guide-icon--movement' : ''}${name === 'photo' ? ' gallery-guide-icon--photo' : ''}`

  if (name === 'movement') return <svg className={className} viewBox="0 0 96 72" aria-hidden="true" focusable="false">
    <rect className="gallery-guide-icon__outline" x="12" y="6" width="72" height="60" rx="8" />
    <path className="gallery-guide-icon__detail" d="M16 18h64" />
    {touch
      ? <g className="gallery-guide-icon__fingers"><path d="M39 31v13m18-13v13" /><path d="m34 34 5-5 5 5m8 7 5 5 5-5" /></g>
      : <>
        <path className="gallery-guide-icon__arrows" d="M29 45V29m-4 4 4-4 4 4m34 8V53m-4-4 4 4 4-4" />
        <g className="gallery-guide-icon__fingers"><path d="M43 29v16m10-16v16" /></g>
      </>}
  </svg>

  if (name === 'photo') return <svg className={className} viewBox="0 0 96 72" aria-hidden="true" focusable="false">
    <rect className="gallery-guide-icon__outline" x="12" y="10" width="57" height="43" rx="3" />
    <circle className="gallery-guide-icon__detail" cx="54" cy="22" r="4" />
    <path className="gallery-guide-icon__detail" d="m18 46 15-15 10 10 7-7 13 13" />
    {touch
      ? <>
        <path className="gallery-guide-icon__hand" d="M59 59V39a4 4 0 0 1 8 0v10l3-4a4 4 0 0 1 7 2l-1 10c-.5 5-4 8-9 8h-2c-3 0-6-2-6-6Z" />
        <circle className="gallery-guide-icon__click-pulse" cx="64" cy="47" r="8" />
      </>
      : <>
        <path className="gallery-guide-icon__cursor" d="m57 34 19 14-9 1 4 10-5 2-4-10-6 6z" />
        <circle className="gallery-guide-icon__click-pulse" cx="64" cy="47" r="8" />
      </>}
  </svg>

  if (name === 'return') return <svg className={className} viewBox="0 0 96 72" aria-hidden="true" focusable="false">
    <rect className="gallery-guide-icon__outline" x="34" y="14" width="49" height="40" rx="3" />
    <circle className="gallery-guide-icon__detail" cx="68" cy="25" r="3.5" />
    <path className="gallery-guide-icon__detail" d="m39 48 12-12 8 7 6-6 13 13" />
    <path className="gallery-guide-icon__return" d="M54 60H31a17 17 0 0 1 0-34h8m-7-7 8 7-8 7" />
    {touch
      ? <path className="gallery-guide-icon__hand gallery-guide-icon__hand--small" d="M57 42v-5a2.6 2.6 0 0 1 5.2 0v7l2-2a2.6 2.6 0 0 1 4.4 1.8l-.5 5.7a6 6 0 0 1-6 5.5h-.7a4.4 4.4 0 0 1-4.4-4.4z" />
      : <path className="gallery-guide-icon__cursor gallery-guide-icon__cursor--small" d="m55 35 12 9-6 1 3 7-4 2-3-7-4 4z" />}
  </svg>

  return <svg className={className} viewBox="0 0 96 72" aria-hidden="true" focusable="false">
    <path className="gallery-guide-icon__arch" d="M12 65h72M20 65V36a28 28 0 0 1 56 0v29M27 65V37a21 21 0 0 1 42 0v28" />
    <rect className="gallery-guide-icon__photo" x="37" y="37" width="22" height="19" rx="1.5" />
    <path className="gallery-guide-icon__photo-detail" d="m39 53 6-6 4 4 3-3 7 7" />
    <circle className="gallery-guide-icon__glint" cx="65" cy="24" r="1.6" />
  </svg>
}

export function GalleryOverlay({ paused }: { paused: boolean }) {
  const { phase, interaction, focus, atEnd } = useSyncExternalStore(subscribeGallery, gallerySnapshot, gallerySnapshot)
  if (phase === 'instruction') return <section className="gallery-intro" aria-label="Как исследовать галерею"><div className="gallery-intro-inner">
    <span className="gallery-intro-star" aria-hidden="true">✦</span>
    <h1>Давай вспомним кое-что…</h1>
    <p className="gallery-intro-subtitle">Прогуляйся по галерее наших воспоминаний</p>
    <div className="gallery-gestures">
      <article className="gallery-guide-item">
        <GalleryGuideIcon name="movement" />
        <GalleryGuideIcon name="movement" touch />
        <h2>Двигайся по галерее</h2>
        <p className="gallery-guide-copy gallery-guide-copy--fine">Проводи двумя пальцами вверх или вниз по трекпаду, чтобы двигаться вперёд или назад.</p>
        <p className="gallery-guide-copy gallery-guide-copy--touch">Своди и разводи пальцы, чтобы двигаться вперёд или назад.</p>
      </article>
      <article className="gallery-guide-item">
        <GalleryGuideIcon name="photo" />
        <GalleryGuideIcon name="photo" touch />
        <h2>Рассматривай фотографии</h2>
        <p className="gallery-guide-copy gallery-guide-copy--fine">Наведи курсор и нажми на фотографию, чтобы приблизить её.</p>
        <p className="gallery-guide-copy gallery-guide-copy--touch">Коснись фотографии, чтобы рассмотреть её ближе.</p>
      </article>
      <article className="gallery-guide-item">
        <GalleryGuideIcon name="return" />
        <GalleryGuideIcon name="return" touch />
        <h2>Возвращайся к прогулке</h2>
        <p className="gallery-guide-copy gallery-guide-copy--fine">Нажми на фотографию ещё раз или используй кнопку «Вернуться к прогулке».</p>
        <p className="gallery-guide-copy gallery-guide-copy--touch">Коснись фотографии ещё раз или нажми «Вернуться к прогулке».</p>
      </article>
    </div>
    <aside className="gallery-guide-note">
      <GalleryGuideIcon name="arch" />
      <div><h2>Последнее воспоминание</h2><p>Последняя фотография — под аркой. Сфокусируйся на ней, и переход в галактику начнётся автоматически.</p></div>
    </aside>
    <button type="button" disabled={paused} onClick={galleryStart}>Начать прогулку</button>
  </div></section>
  if (phase !== 'explore') return null
  const finalExhibit = focus === GALLERY_MEMORIES.length - 1
  return <div className="gallery-navigation" aria-label="Управление галереей"><label className="gallery-accessible">Выбрать фотографию<select aria-label="Выбрать фотографию" disabled={paused || interaction !== 'walk'} value={focus ?? ''} onChange={(event) => galleryFocus(event.target.value === '' ? null : Number(event.target.value))}><option value="">Прогулка</option>{GALLERY_MEMORIES.map(memory => <option key={memory.id} value={memory.order}>{memory.title || memory.caption}</option>)}</select></label><div className="gallery-move"><button type="button" disabled={paused || focus !== null} onClick={() => travel(-5)} aria-label="Двигаться назад">←</button><button type="button" disabled={paused || focus !== null} onClick={() => travel(5)} aria-label="Двигаться вперёд">→</button></div>{focus !== null && <button type="button" disabled={paused || interaction === 'returning' || finalExhibit} onClick={() => galleryFocus(null)}>Вернуться к прогулке</button>}{atEnd && focus === null && <button type="button" disabled={paused} onClick={galleryExit}>Продолжить</button>}</div>
}

