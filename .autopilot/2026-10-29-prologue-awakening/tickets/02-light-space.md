# 02 — Живой свет, глубина и касание
Требования: R07–R22,R51–R64,R65–R68,R71–R73,R75–R84,R87–R94. Общее R01–R06.
Blocked by:01
Зона: PersistentLight/App light wiring/style, Growth entry, новый scenes/prologue/PrologueAtmosphere.tsx, DeveloperPanel prologue controls, useAudioDirector, связанные тесты.
Волна:2

Из брифа: «Не создавай вторую независимую точку»; «Очень маленькое, чёткое и яркое ядро»; «Максимального художественного качества минимальными средствами»; «0,7–1 секунды».

Спецификация: Light, Atmosphere, Interaction, Audio, Composer, Validation.

Приёмка:
- Один existing app-level свет, до2с мягкое рождение,4.5с restrained breathing, second response, post-dust invitation pulse. Runtime-owned phase; waiting дышит при18 gate, pause/speed/hidden корректны. Ready preparation сохраняется.
- Core ivory tiny crisp, nonlinear inner glow, outer barely visible/non-disk. Настройки01 потребляются. Центр viewport fixed.
-60–80CSSpx hit radius, keyboard/native button, disabled before waiting, focus visible, никаких CSS автономных анимаций в прологе.
- Реакция touch .85с, pearl-pink, одна тонкая волна, первые привлекаемые пылинки (можно procedural DOM/GPU VFX но не второй core). Минимальный handoff Growth с общей точкой, без скачка/дублирования/black frame/повторного awakening. Не перерабатывать growth art.
- Процедурная атмосферная плоскость+разреженные points в текущемcanvas, пауза/idle из общегоruntime, quality scaling/reduced motion, clean GPU lifecycle; почти пустой старт, деликатные #101A33,#F4CDD9,#B9A4E8 оттенки. Export PrologueAtmosphere(SceneProps), сообщить03, НЕ менять PrologueScene.
- Значимые Composer настройки всех пяти групп, сохранение presets/history/reset/import/export и local font/copy selection.03 потребляет type/dissolve поля.
- Audio cues derive from actual configured windows; no fake music, preserve sound/autoplay, no duplicate touch.
- Focused tests и typecheck; сообщить3–5 рекомендуемых tuned defaults. Не коммитить.
