# 02 — Девять модулей, единая камера и Canvas

Требования: R06, R10, R16–R23, R28, R30, R36–R39, R46–R49. Blocked by: 01. Волна: 2. Зона: frontend/src/scenes/**, frontend/src/engine/SceneDirector.tsx, CameraDirector.tsx, FilmCanvas.tsx, scene types.

Из брифа: «простые, аккуратные 3D-заглушки»; «один основной React Three Fiber Canvas»; «Движение камеры должно быть централизованным»; «Не пытайся … воспроизвести финальный художественный стиль».

Разделы spec: Сценарий и приёмка, Границы и швы. Геометрия простая и ограниченная. Явные модули для 9 сцен. Подписи/имя допускаются DOM в задаче 03, но flower/particles/portrait/photo нужны отличимые объекты. Не загружать внешние шрифты через Drei Text. Использовать простые плоскости/рамки для фото и портрета, именование в DOM делает 03. Blue spark остаётся сквозным. Новый FilmCanvas props должны быть SceneProps из контракта, quality из state (если есть) или отдельный prop со default.

Приёмка:
- Существующий один Canvas сохраняет fallback/context-loss handler cleanup и demand rendering. CameraDirector единолично движет camera GSAP timeline через runtime, учитывает aspect, pause, speed, reduced-motion; smooth gallery tween, no timers to advance photos.
- Реальные касания точки/бутона dispatch interact только на соответствующем gate. Галерейные карточки dispatch gallery-focus; pointer movement у eye имитирует взгляд, не управляет временем.
- Точные переходы видимости/геометрии по общим cues и хорошие статические состояния waiting/reduced motion, включая переход из growth в bloom без обнуления цветка, bloom→identity, eye→cosmos. Один видимый светящийся seed в прологе.
- Плавные переходы и корректное уничтожение timelines/listeners/GPU objects при уходе/restart/StrictMode. Жизненный цикл не зависит от elapsed React rerenders.
- Проверить typecheck/lint; App временно несовместим до интеграции 03, это допустимо, но укажи ошибки отдельно. Не менять UI или engine state.
