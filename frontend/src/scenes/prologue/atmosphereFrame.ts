export interface PrologueAtmosphereFrame {
  reveal: number
  time: number
}

/** The prologue background atmosphere stays at its opening appearance for every film time. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Time is intentionally ignored to keep the backdrop static.
export function getPrologueAtmosphereFrame(_time: number): PrologueAtmosphereFrame {
  return { reveal: 0, time: 0 }
}
