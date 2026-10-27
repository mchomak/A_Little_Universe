export function GraphicsFallback({ hidden = false }: { hidden?: boolean }) {
  return (
    <div className="graphics-fallback" aria-hidden={hidden} role={hidden ? undefined : 'alert'}>
      <h2>3D-сцена недоступна</h2>
      <p>Нужен браузер с WebGL2 и включённым аппаратным ускорением. Попробуйте обновить страницу или открыть её в другом браузере.</p>
      <button type="button" onClick={() => window.location.reload()}>Перезагрузить</button>
    </div>
  )
}
