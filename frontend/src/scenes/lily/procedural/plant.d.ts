import type { Group, Mesh } from 'three'

export interface ProceduralLily {
  object: Group
  head: Group
  leaves: Mesh[]
  tepals: Mesh[]
  setPose(growth: number, bloom: number): void
  dispose(): void
  ready: Promise<void[]>
}

export function createProceduralLily(options?: { textures?: boolean }): ProceduralLily
