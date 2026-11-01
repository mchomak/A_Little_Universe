# 02 — Порог растворения центра цветка

**Требования:** R06, R07, R11, R12
**Blocked by:** —
**Зона:** GLB surface classification / shared dissolve field
**Волна:** 1

## Приёмка

- Petals и Petals_Outside остаются первой фазой; meshes with `Anther_SoftGold` and `Filament_Ivory` materials (GLTFLoader draw meshes `Cube003`/`Cube003_1`), pistil, and Calyx begin gradual dissolve near 50% of the petal range.
- Stem и обе листья растворяются последними с перекрытием предыдущих фаз.
- Частицы центра возникают на фактической поверхности GLB и используют тот же field/вихрь.
- Стык 03→04 и камера остаются прежними; фазы воспроизводимы на прямом seek и повторном просмотре.
- Actual GLB center material identities and phase mapping are covered by tests; desktop t=6/8 screenshots confirm overlap and ordering.

**Status:** done. Focused `dissolve.test.ts` and `particleSource.test.ts` pass; full `npm run check` passes.
