# Приёмка каркаса — 2026-10-27

Независимая слепая проверка брифа и фактического кода: незакрытых функциональных требований не найдено. Manifest/Spec и Craft reviews завершены; исправлена ранняя видимость стебля и несогласованное reduced-motion падение. Документация перечитана проверяющим после обновления.

- `npm run check`: ESLint, 13 тестов / 7 файлов, strict TypeScript, production build — exit 0.
- Browser: `browser-check.py` — реальный маршрут с GSAP speed 4, без dev skip; ручные gates, галерея, pause, reading, credits, ending/replay. Offline от выхода из галереи через финал и повторные входы. Одна и та же Canvas DOM-нода. Все девять dev jump, restart/seek, reduced motion, responsive и отсутствие внешних запросов/pageerror.
- `browser-extra.py`: реальные 3D касания точки/бутона, фактический DPR 1.5 → 1, production `?debug` без панели. Статический JS не содержит маркеров панели.
- Headless Chrome/Playwright, software WebGL; screenshots и JSON в `evidence/` просмотрены. Обычное окно Chrome при occlusion давало ненадёжную частоту кадров, поэтому итоговые проверки выполнены в отдельном headless процессе.
- Backend не менялся. AGENTS.md и storyboard SHA256 сохранены.

Ограничения: целевой планшет, Safari, аппаратная производительность не проверены. Сохраняется существующее предупреждение Vite о чанке Three/GSAP >500KB. Offline reload/SW, музыка, личные материалы и media-функции в этот этап не входят. Никаких коммитов или публикации не выполнялось; изменения оставлены в working tree.
