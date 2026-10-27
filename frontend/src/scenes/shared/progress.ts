export const ramp = (time: number, cue: readonly [number, number]) => Math.max(0, Math.min(1, (time - cue[0]) / (cue[1] - cue[0])))
export const smooth = (value: number) => value * value * (3 - 2 * value)
