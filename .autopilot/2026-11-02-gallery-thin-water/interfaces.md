# Границы, решённые в спецификации
Стек: существующие React/TypeScript/Vite/Three/R3F/Drei/GSAP. Новых зависимостей нет. Один Canvas и renderer, CameraDirector владеет камерой, galleryMotion.time — время анимации. Сохранять геометрию/композицию/облака/фото.

01: config + DevPanel, schema12, настройки gallery: reflectionStrength [0,.6] default .42; reflectionBlur [.3,1] default .6; waterDistortion [0,.05] .008; waterRippleSpeed [0,1] .12; waterNormalStrength [0,1] .22; moonHighlightStrength [0,2] .7; waterOpacity [0,1] .9. Старые явные значения сохранять.
02: WetFloor + planar module/material + GalleryScene/MoonlitWorld integration + scene tests/docs. Не писать конфигурацию и DevPanel.
Команды из frontend: npm run dev -- --port 5175; npm run check; npx vitest run <file>. Не добавлять зависимости, при отсутствии — BLOCKED.

## Из таска01
Schema12; normalizeConfig принимает1–12. Все7 water controls подключены к общему config store. Config30, DeveloperPanel7, composerControls18 тестов проходят. Старые явные значения сохранены.

## Task02
Planar pass: render(renderer,scene,camera,reflector),target,textureMatrix,dispose. Water material updates gallery settings/time/camera without per-frame React state. 429 tests passed.
