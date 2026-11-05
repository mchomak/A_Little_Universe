# Spec

Сохранить всё локальное состояние и исходные ветки. Создать интеграционный worktree от origin/main и fast-forward до локального main, поскольку он потомок origin/main и содержит 68 новых коммитов. Источники сравнивать по зафиксированным SHA и merge-base; не сливать их целиком.

02: только исправления семечка; изменения облаков, света, острова, роста, прочих сцен исключить. Если подходящих исправлений нет, не создавать фиктивный коммит и зафиксировать причину.

04: адаптировать только совместимые изменения камеры, проявления и рамки, сохранив расчёт от фактической посадки частиц, реальные лилию, вихрь, ресурсы и DEV-настройки. Не заменять актуальные системы старыми.

05: адаптировать привязку арки, геометрию коллажей, длительное формирование и постепенное проявление, устойчивые focus/unfocus, сохранив данные и навигацию; минимальные изменения общих галерейных путей допустимы.

Проверка: diff и релевантные тесты каждой области; отдельные коммиты только для реальных изменений. Сравнить с d631793, провести полный npm run check, production и браузерные проверки, включая DEV и обычный запуск. Зафиксировать недоступные проверки. Push интеграции и fast-forward/push main только после прохождения требуемых проверок и повторного fetch; при существенной регрессии остановиться. Запустить сайт из итогового main и сообщить точные SHA, файлы, проверки и пропуски.

## Acceptance details

- Seed: inspect formation, fall and impact code and validate any actual seed hunk. Do not carry old island, lily, growth, bloom, clouds or lighting. Review A has no seed algorithm edits; record this instead of manufacturing a commit.
- Portrait: smooth camera retreat to approximately two thirds viewport height without a FOV jump; shorten the pause after final actual landing, slow the face-first photo reveal while particles fade naturally, and assemble a thin particle frame around the photo in approximately three seconds. Preserve timeline length, seek, replay and stable end state; avoid replacing arrival-driven logic.
- Gallery: anchor arch to final column pair and follow count/length controls; arrange 2–3 extra photos with preserved aspect, approximately 10% smaller than main and with clear gaps. Assemble for around 5 seconds then reveal actual photos progressively. Only selected collage animates; rapid exit/refocus must clean up and release resources. Preserve actual images, captions, event order, navigation, clouds, water and moonlight.
- Audit merge bases, individual commits, exact files and hunks as new vs stale, worktree dirty states and signs of active work; inspect original Review prompts and relevant Autopilot artifacts. Do not wholesale merge source branches, restore whole old files, or copy old configuration. Preserve DEV presets, scene 01, 03 and GLB, lily dissolve and vortex, 06–09, galaxy, greeting, routes, camera and runtime except minimal scoped adaptations.
- After each actual port inspect diff, permitted areas, collateral changes, run relevant tests, then use requested scene-specific commit message. Compare final against d631793 with stat, name-status and targeted files. Check assets in built application, normal playback and DEV seeking for 02, 04, 05; compare baseline and result using identical presets when possible, with honest visual limitations.
- Push integration after verification. Fetch again and compare origin/main; if it advanced, integrate safely and rerun affected checks. Only then fast-forward main and push without force if all checks pass; leave integration for review on material regression or conflict. Report table by source, changes and exclusions/reason/commit, both SHA values, all files, checks, shared components, unchanged scenes, visual evidence and local final-main URL.
- Begin audit with git fetch, git worktree list and git status. Compare each candidate hunk against current main and skip functionality already present. Inspect the Review A/B/C checklists; if DEV notes are available and the corresponding fix is verified, mark only ready_for_review, never done; report if unavailable or unverified.
