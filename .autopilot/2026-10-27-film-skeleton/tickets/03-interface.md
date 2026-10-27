# 03 — Сквозной интерфейс, жесты и Developer Mode

Требования: R03–R05, R16–R17, R19, R21, R24–R27, R31–R35, R40–R44, R47–R50. Blocked by: 01. Волна: 2. Зона: frontend/src/app/**, frontend/src/debug/**, frontend/src/components/**, frontend/src/engine/useReducedMotion.ts при необходимости.

Из брифа: «Нажать кнопку начала представления … Пройти все сцены … Взаимодействовать с цветком и галереей»; «Developer Mode … доступный только при разработке»; «паузу и режим обычного чтения».

Разделы spec: все сценарии, Границы и швы. Используй {state, dispatch, runtime}=useFilm(), FilmCanvas получает их плюс reducedMotion. В 02 создаются новые SceneProps. Согласуй через orchestrator любые расхождения, не редактируй их файлы.

Приёмка:
- Стартовый экран, заголовок и честный прототип-status, кнопка «Открыть подарок». Чистое fullscreen cinematic пространство после старта, минимальные header/footer и overlays; ассеты локальные. Системные serif/sans текущего проекта, без художественного redesign или новых изображений.
- Пролог две точные утверждённые фразы с fade, prompt после исчезновения, доступная кнопка для 3D touch; flower prompt из COPY, потом без текста во время раскрытия; identity имя/placeholder labels по cues; eye лишь нейтральная подпись симуляции; никаких выдуманных личных фраз.
- Галерея кнопки, вертикальные pointer swipes touch (порог, pointercancel cleanup; UI кнопки не запускают gestures), подпись всегда доступна для чтения; выйти к глазу только последняя карточка + явная кнопка. Можно back/forward сколько нужно, никаких автоматических переключений. Индекс 1/6. Повторная галерея из конца с возвратом.
- Поздравление заголовок, пожелание затем медленные перспективные титры, GSAP scrub от runtime и пауза касанием + кнопка; временный текст явно отмечен; обычное чтение доступно без таймера/перекрытия controls. У finish ручной gate и конец с 3 действиями. Reading можно реализовать inline overlay с доступным закрытием/focus, scroll на маленьких экранах.
- DevPanel lazy только import.meta.env.DEV, ?debug открывает и есть dev-only toggle в любой момент. Scene select + run, restart, pause, speed, skip, mode/time, actual approximate FPS (sample rAF/render loop с cleanup, не придумывать 60), simulate interact/gallery step, scrub slider. Все временные числа config; player quality normal/low можно UI/select.
- Адаптивность tablet landscape/portrait +390px, минимум touch target44, visible focus/disabled states, reduced-motion without stalled story, manual pause retained across reading. npm lint/typecheck при готовом 02.
