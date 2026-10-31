# Спецификация: Scene 04 — частицы и последовательность распада

## Задача

Сделать уже работающий GPU-распад GLB-лилии плотнее и выразительнее, сохранив естественные материалы и читаемый крупный силуэт цветка в начале. Вихрь должен оставаться связанным с точками, отделившимися от реальной поверхности модели.

## Решение

- Увеличить default count с 36k до 48k; максимум DEV 64k, профиль low ограничить 12k. Один `Points` draw call, без CPU обновления частиц и новых зависимостей.
- Добавить редкие умеренные акценты размера и яркости поверх множества мелких точек. Ограничить point size и яркость, чтобы избежать пятен и пересвета.
- Использовать один общий world-space field для GLB и частиц. Цель центральных частей вычисляется из порога завершения лепесткового поля; default `.5` означает середину диапазона распада лепестков, диапазон/пространственный разброс оставляет мягкое перекрытие.
- Сделать широкую, объёмную восходящую спираль: положительный XZ поворот подтверждается экранной проекцией основной камеры; скорость плавно растёт с возрастом точки. Радиус и расширение ограничиваются так, чтобы вихрь оставался в кадре достаточно долго.
- Параметры доступны из DEV панели и поступают в uniforms, обновляемые общим временем фильма; прямой seek и повторный просмотр должны выдавать тот же кадр.
- Геометрия предметных фаз: лепестки phase 0; `Anther_SoftGold`, `Filament_Ivory`, пестик и Calyx phase 1; Stem/Leaf_A/Leaf_B phase 2. Three GLTFLoader exposes the actual visible center draw meshes as `Cube003`/`Cube003_1`, so runtime material names classify both the GLB fragment shader and sampled particle source. The orbit cap never starts below each sampled source radius. The model, camera, and scene transition remain shared with the existing implementation.

## Приёмка

1. 48k default, ограничение low 12k, безопасный диапазон DEV до 64k.
2. Нет shader compile/WebGL errors; оттенки остаются жемчужно-белыми, розовыми и приглушённо-золотыми.
3. Кадры на 3, 6, 9 и 12 секундах показывают цельный широкий восходящий поток без потери его до завершения распада.
4. Центральные элементы начинают dissolve на середине диапазона фаз лепестков; стебель/листья остаются последними.
5. Seek назад, вперёд и повторный вход воспроизводят ту же форму для того же времени; confirmed by repeated desktop playback and direct timeline seeks.

## Вне рамок

Камера и стык 03→04, портрет и фотография, новый particle system, новые библиотеки, изменение длительности 12 секунд.

## Решения

- ASSUMPTION: сохранять sample-once GLB geometry и существующий shader-based motion; добавление GPU draw call и CPU simulation не требуется.
- Схема Composer v5 остаётся additive; старые JSON overrides читаются по прежним полям и получают defaults для новых настроек.
- Verification limitation: physical iPad/Safari GPU performance was not measured; low-quality point-count cap remains 12k.
