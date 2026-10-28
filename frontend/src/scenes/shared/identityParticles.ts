/** The 04.1 handoff: one stable position and seed per particle, in scene coordinates.
 * A future lily dissolve may provide its own samples without changing the morph renderer. */
export interface LilyParticleSource {
  sample(index: number, count: number): [number, number, number]
}

export const mockLilyParticles: LilyParticleSource = {
  sample(index, count) {
    const t = index / count
    const angle = index * 2.399963
    const radius = Math.sqrt(t) * 1.1
    return [Math.cos(angle) * radius, Math.sin(angle) * radius, Math.sin(angle * 2.4) * 0.32]
  },
}
