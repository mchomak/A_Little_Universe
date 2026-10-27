export function galleryPosition(index: number): [number, number, number] {
  return [index === 0 ? 0 : (index % 2 === 0 ? -0.85 : 0.85), index % 2 === 0 ? 0.08 : -0.08, -index * 4.8]
}
