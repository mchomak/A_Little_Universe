# 01 — Контракт времени и художественных настроек
Требования: R03,R05,R25,R26,R47–R50,R58,R64–R73,R77,R80,R90. Все общие инварианты R01–R06,R75–R84.
Blocked by: —
Зона: config/filmConfig/film/runtime/audio cue definitions и их тесты. Не менять визуальные компоненты/DeveloperPanel/useAudioDirector.
Волна:1

Из брифа: «использовать текущий film clock как единственный источник времени»; «Не ломай существующие конфигурации.»; «без причины не растягивай пролог обратно до21 секунды».

Спецификация: Interaction и тайминг, Composer, Audio, Validation, Light (clock контракт).

Приёмка:
- Default точные окна0–2 /2–5.5 /7–10.5 /12.5–16 /prompt16–18, gate18. Настройки bounded и backward compatible.
- Новый copy default, legacy доступен через config; getter copy, понятный другим исполнителям.
- Добавить значимые prologue поля с нормализацией defaults старых v1/v2 и size-range consistency. Рекомендуемые имена (можно уточнить и вернуть): coreIntensity, innerGlowRadius, outerGlowRadius, phraseResponse, touchIntensity, touchDuration, waveStrength, waveRadius, atmosphereDensity, hazeIntensity, spaceDepth, driftSpeed, secondFontScale, textGap, textGlow, copyVariant, particleSizeMin, particleSizeMax, particleGlow. Сохранить legacy glow/pulse поля. Значения defaults artistic restrained, дыхание4.5с. Новые поля реально потребляются02/03.
- FilmRuntime предлагает controlled presentation time для waiting без второго clock, без изменения elapsed/gate. Pause/speed/hidden/replay/seek работают, listeners cleanup. Existing scene time НЕ должен превышать18 в waiting.
- Один transition duration getter из config (~.85с) и filmDuration/state transition. Учесть live-config mutation bounds/capture duration consistency.
- Audio cues definitions для first/second/dissolve/touch без случайных файлов; timestamps получает02.
- Поведенческие тесты на gate/waiting/runtime/replay/legacy config/frame windows. Запустить focused tests,typecheck; полныйcheck после связанной интеграции.
- Вернуть точные signatures/новые поля/путь runtime idle API для02/03. Ничего не коммитить.
