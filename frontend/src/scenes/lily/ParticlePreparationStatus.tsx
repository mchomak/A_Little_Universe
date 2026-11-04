import { Html } from '@react-three/drei'

/** A small, non-blocking status overlay that leaves the flower visible. */
export function ParticlePreparationStatus({ message }: { message: string }) {
  return <Html fullscreen pointerEvents="none">
    <div role="status" aria-live="polite" style={{
      position: 'absolute',
      top: 'max(18px, env(safe-area-inset-top))',
      left: '50%',
      transform: 'translateX(-50%)',
      padding: '8px 14px',
      border: '1px solid rgba(224, 212, 255, 0.22)',
      borderRadius: 999,
      background: 'rgba(12, 12, 28, 0.76)',
      color: '#f1eaff',
      boxShadow: '0 4px 18px rgba(0, 0, 0, 0.22)',
      font: '500 13px/1.3 system-ui, sans-serif',
      letterSpacing: '0.01em',
      whiteSpace: 'nowrap',
    }}>{message}</div>
  </Html>
}
