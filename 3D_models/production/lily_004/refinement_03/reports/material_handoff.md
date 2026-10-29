# T02 material study — handoff

СДЕЛАНО: material study повторно построен из tracked `baseline/live_v2_04m_unsaved.blend`; SHA-256 `e827b67680e57bc2e6344e03bf6d289c56e838acf5e0427e227ef6ea1efefc12` совпадает с `baseline/checksums.sha256`.
СДЕЛАНО: финальный GLB 2,407,440 bytes, SHA-256 `61f40893994793746a18f111da9cc15ece3034a034118b76163e7df25d08dc8a`; `geometryPreserved=true`.
СДЕЛАНО: `sourceCurveSampleCheck` в отчёте прошёл через прямой `scene.frame_set` для Growth t=0, 2.25, 4.5, 5.625, 6.75, 7.875 и 9 секунд у обеих материй лепестков.
СДЕЛАНО: проверка геометрии подтвердила 2,970 парных вершин/поверхность, 2,688 парных граней, нулевой зазор по Basis и всем 16 shape keys, диапазон dot product нормалей `[-1.00000027, -0.99999974]`.
СДЕЛАНО: пара `Petal_Pearl`/`Petal_Outside` экспортируется one-sided; только `Leaf_SoftGreen` остаётся double-sided. Это устраняет одновременное отображение coincident surfaces.
СДЕЛАНО: все 7 PNG-карт packed в blend и embedded в GLB, максимум 512×512; повторный импорт Blender прочёл `Image.pixels` каждой карты и подтвердил `has_data=true`.
СДЕЛАНО: GLB reimport также проверил 5,376 triangulated faces/поверхность, нулевой зазор, противоположные нормали (`[-1.00000024, -0.99999984]`) и one-sided PBR flags; glTF triangulation удваивает исходные quad faces.
СДЕЛАНО: изображения young 0s, mature 9s и mature open Bloom сохранены в `screenshots/material_material_study/`; учебные кадры используют временные камеру/свет, удалённые до сохранения asset.

ФАЙЛЫ: `scripts/refine_materials.py`; `scripts/check_material_contract.py`; `scripts/check_material_reimport.py`.
ФАЙЛЫ: `scripts/material_viewer_adapter.py`; `scripts/check_material_viewer_adapter.py`; `scripts/test_material_viewer_adapter.py`; `scripts/material_viewer_assets/viewer.html`; `scripts/material_viewer_assets/viewer.js`.
ФАЙЛЫ: `source/lily_004_material_study.blend`; `export/lily_004_material_study.glb`; `export/bud_maturation.json`; `reports/material_material_study.json`; `reports/material_reimport.json`.
ФАЙЛЫ: `reports/material_viewer_adapter.json`; `textures/*`; `screenshots/material_material_study/*`; `reports/material_handoff.md`.

КОМАНДЫ:
`blender --background 3D_models/production/lily_004/refinement_03/baseline/live_v2_04m_unsaved.blend -t 12 --python 3D_models/production/lily_004/refinement_03/scripts/refine_materials.py -- --output-root 3D_models/production/lily_004/refinement_03 --name lily_004_material_study` → exit 0; отчёт содержит вход/выход, signature, textures, sample checks и скриншоты.
`C:/Users/McHomak/AppData/Roaming/uv/python/cpython-3.14.6-windows-x86_64-none/python.exe 3D_models/production/lily_004/refinement_03/scripts/check_material_contract.py 3D_models/production/lily_004/refinement_03/export/lily_004_material_study.glb --json 3D_models/production/lily_004/refinement_03/export/bud_maturation.json` → `PASS: 2 material curves; 7 embedded PNGs <=512px`; checker также требует mature GLB factors, OPAQUE материалы, zero metallic, paired one-sided petals, double-sided leaves и отсутствие pointer extension.
`blender --background --python 3D_models/production/lily_004/refinement_03/scripts/check_material_reimport.py -- --glb 3D_models/production/lily_004/refinement_03/export/lily_004_material_study.glb --report 3D_models/production/lily_004/refinement_03/reports/material_reimport.json` → `PASS: Blender GLB reimport; 6 materials; 7 decoded embedded images`; JSON also records paired normals and sidedness.
`C:/Users/McHomak/AppData/Roaming/uv/python/cpython-3.14.6-windows-x86_64-none/python.exe -m py_compile 3D_models/production/lily_004/refinement_03/scripts/refine_materials.py 3D_models/production/lily_004/refinement_03/scripts/check_material_contract.py 3D_models/production/lily_004/refinement_03/scripts/check_material_reimport.py` → PASS.
`C:/Users/McHomak/AppData/Roaming/uv/python/cpython-3.14.6-windows-x86_64-none/python.exe -m unittest discover -s 3D_models/production/lily_004/refinement_03/scripts -p test_material_viewer_adapter.py` → 3 tests passed, including live ephemeral HTTP GET/HEAD, method allowlist, route mapping, directory suppression, and traversal rejection.
`C:/Users/McHomak/AppData/Roaming/uv/python/cpython-3.14.6-windows-x86_64-none/python.exe 3D_models/production/lily_004/refinement_03/scripts/material_viewer_adapter.py --asset 3D_models/production/lily_004/refinement_03/export/lily_004_material_study.glb --three-root C:/Users/McHomak/Projects/A_Little_Universe/frontend/node_modules/three --port 5182` → `MATERIAL_VIEWER_READY`; keep this process running for root's existing IAB.
`C:/Users/McHomak/AppData/Roaming/uv/python/cpython-3.14.6-windows-x86_64-none/python.exe 3D_models/production/lily_004/refinement_03/scripts/check_material_viewer_adapter.py --base-url http://127.0.0.1:5182` → `PASS: HTTP readiness; 13 read-only route checks`.

АДАПТЕР: preview URL `http://127.0.0.1:5182/scripts/viewer.html?asset=final`; binds only `127.0.0.1`. `viewer.html` SHA-256 `564932e604bec309e5ca965290a17fa7797b1148f7dcfff8c2fddcbe1f1a98b7`; `viewer.js` SHA-256 `d9e82a577f5878572383ce06097ad0369db58b31ecd9b99a75e6b628afe1bf64`; stored copies match sources byte-for-byte. `/export/lily_004_animated.glb` serves the study GLB (SHA-256 `61f40893994793746a18f111da9cc15ece3034a034118b76163e7df25d08dc8a`); `/frontend/node_modules/three/*` maps to installed Three 0.186.1 in the primary checkout read-only. Hashes and HTTP checks are in `reports/material_viewer_adapter.json` and `reports/material_material_study.json.viewerAdapter`.

РЕШЕНИЯ: mature blush/lavender tint baked в base-color maps; оба mature linear-sRGB growth factors равны 1.0. Non-Growth clips используют mature; crossfade — 0.25s в linear-sRGB; reverse scrub пересчитывает absolute source/target clip time.
РЕШЕНИЯ: обычный GLTFLoader не анимирует `baseColorFactor` из extras. Runtime читает `Lily_Root.extras.ALU_budMaturation`; schema v1 и sidecar семантически равны; `KHR_animation_pointer` не используется.
РЕШЕНИЯ: золотой anther — dielectric metallic 0.0, roughness 0.44; filament roughness 0.52.

ОГРАНИЧЕНИЕ: обычный viewer lighting и видимость правого листа в текущем GLB ещё не проверены визуально; root использует существующий IAB по preview URL. Порты 5179/5181 и frontend не изменялись, новый browser tab/process не запускался.
ДЛЯ T03: применить CLI к geometry-stage blend теми же output/name аргументами; сверить neutral material renders, затем проверить правый лист и paired petals из существующего viewer при обычных hemi/key/rim lights.
