export function galleryPosition(index: number): [number, number, number] {
  // Spread later cards beyond the first photo's silhouette even after perspective.
  return [index === 0 ? 0 : (index % 2 === 0 ? -1 : 1) * (2.4 + index * 0.9), index % 2 === 0 ? 0.08 : -0.08, -index * 4.8]
}
