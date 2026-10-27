import { useEffect, useRef, type Dispatch } from 'react'
import { COPY } from '../engine/filmConfig'
import type { FilmAction } from '../engine/film'

export function ReadingPanel({ dispatch }: { dispatch: Dispatch<FilmAction> }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const element = dialog.current
    element?.showModal()
    return () => {
      element?.close()
      if (previous?.isConnected) previous.focus()
      else document.querySelector<HTMLElement>('[data-testid="open-reading"], [data-testid="ending-reading"]')?.focus()
    }
  }, [])
  return <dialog ref={dialog} className="reading-panel" aria-labelledby="reading-title" data-testid="reading" onCancel={(event) => { event.preventDefault(); dispatch({ type: 'close-reading' }) }}>
    <header><h2 id="reading-title">Поздравление</h2><button type="button" data-testid="close-reading" onClick={() => dispatch({ type: 'close-reading' })}>Закрыть чтение</button></header>
    <article tabIndex={0}><h3>{COPY.greetingTitle}</h3><p>{COPY.greetingWish}</p><h4>{COPY.letterTitle}</h4><p>{COPY.letter}</p><p className="prototype-note">{COPY.credits}</p></article>
    <p className="reading-note">Фильм остановлен на время чтения.</p>
  </dialog>
}
