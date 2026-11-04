import type { LilyParticlePreparationSnapshot } from '../scenes/lily/lilyParticlePreparation'

export function LilyParticlePreparationBanner({
  snapshot,
  development,
  onRetry,
}: {
  snapshot: LilyParticlePreparationSnapshot
  development: boolean
  onRetry(): void
}) {
  if (!development || snapshot.status === 'idle' || snapshot.status === 'ready') return null

  if (snapshot.status === 'error') return <div className="particle-preparation-banner particle-preparation-error" role="alert" data-testid="particle-preparation-status">
    <span>Не удалось подготовить световой вихрь.</span>
    <button type="button" onClick={onRetry}>Повторить</button>
  </div>

  return <div className="particle-preparation-banner" role="status" aria-live="polite" data-testid="particle-preparation-status">
    <span className="particle-preparation-spinner" aria-hidden="true" />
    <span>Подготавливаем световой вихрь для актуальных настроек…</span>
  </div>
}
