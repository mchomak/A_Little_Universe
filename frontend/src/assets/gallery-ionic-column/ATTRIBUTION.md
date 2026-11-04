# Ionic column model attribution

- **Title:** Free Simple Ionic Column / Colonne Ionique
- **Creator:** caton.laubergiste
- **Source:** [Sketchfab model page](https://sketchfab.com/3d-models/free-simple-ionic-column-colonne-ionique-2204555f977149c38d82a31aea4393ab)
- **License:** [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/)
- **Local asset:** `column.glb` (downloaded by the project owner)

The runtime preserves the supplied marble texture and the GLB's part transforms, which convert its source mesh into the gallery's Y-up axes. To keep the original volute above the normal camera view, it retains the original shaft transitions at the base and capital, clips and repeats five copies of the central shaft surface along source Z (mapped to scene Y), then raises the unchanged volute to meet it. Adjacent central sections alternate direction so their full cross-section contours meet exactly; clipped vertex attributes are interpolated from the source geometry, with UV orientation corrected on reversed sections. The resulting buffers are shared across column instances, so the added length does not add per-section draw calls. The base and capital geometry remain unchanged. The runtime also applies a cool moonlit material tint and removes the embedded camera and sun objects.
