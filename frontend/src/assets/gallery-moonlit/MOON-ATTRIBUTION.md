# Lunar surface map

- `lroc-color-2k.jpg` is the 2048 × 1024 sRGB lunar color map from NASA's Scientific Visualization Studio, CGI Moon Kit (ID 4720).
- Source: https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_2k.jpg
- NASA SVS credits: visualization by Ernie Wright (USRA); scientist Noah Petro (NASA/GSFC). The map adapts the LROC WAC natural-color Hapke-normalized mosaic assembled from Lunar Reconnaissance Orbiter data.
- `ldem-3-8bit.jpg` is NASA SVS's 1024 × 512 8-bit LOLA displacement-map preview from the same CGI Moon Kit. It is used as a subtle bump map, not as geometrically exact terrain.
- Source: https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/ldem_3_8bit.jpg
- NASA describes this map as optimized for aesthetics. It is mapped equirectangularly onto the gallery's SphereGeometry; the project adds no scientific topographic claim.
- Reference/demo consulted for the real spherical texture and per-surface lighting approach: https://github.com/CoryG89/MoonDemo (Clementine map and GLSL diffuse-light example; separate source data, not reused here).
