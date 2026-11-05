# Requirements and audit

| ID | User requirement | Status | Track |
|---|---|---|---|
| R01 | «не допуская отката других сцен или общих систем проекта» | in-ticket | all, audit |
| R02 | «Выполни git fetch, git worktree list, git status и проверь историю всех трёх веток» | in-ticket | audit |
| R03 | «зафиксируй исходные SHA всех четырёх веток» | in-ticket | audit |
| R04 | «только сцена 02 ... формирование, падение и столкновение семечка» | in-ticket | 01 |
| R05 | «только сцена 04 ... портрет ... масштаб ... тайминг ... рамки» | in-ticket | 02 |
| R06 | «только сцена 05 ... галерея, арка, коллажи и дополнительные фотографии» | in-ticket | 03 |
| R07 | «При любом расхождении актуальный main имеет приоритет» | in-ticket | all |
| R08 | «Не изменяй исходные feature-ветки и их worktree» | in-ticket | all |
| R09 | «После каждого этапа A/B/C ... diff ... тесты ... отдельный коммит» | in-ticket | 01–03 |
| R10 | «отдельный regression audit» | in-ticket | 04 |
| R11 | «npm run check ... production build и загрузку необходимых ассетов» | in-ticket | 04 |
| R12 | «обычное воспроизведение и DEV-перемотку ... визуально» | in-ticket | 04 |
| R13 | «push ... integration ... Повторно проверь ... origin/main ... fast-forward ... push ... без force» | in-ticket | 04 |
| R14 | «Если обнаружена существенная регрессия или неразрешённый конфликт ... не переносить ... в main» | in-ticket | 04 |
| R15 | «финальный отчёт ... исходный и итоговый SHA ... файлы ... проверки ... ссылка» | in-ticket | 04 |
| R16 | «Найди Markdown-промпты Review A/B/C ... состояния .autopilot» | in-ticket | audit |
| R17 | «запусти сайт из итогового main на свободном порту» | in-ticket | 04 |

Исходные SHA: origin/main 6748e24c096720dd7f961200b436eefcd38642b1; локальный main d631793166e150c19730fafba497387b97f499d2; scene02 febf5faded5dc067c86d0361ab799389ba57f118; scene04 8159cfcec84ba2c99de9c0fab9d2a66ecba381f1; gallery e42b67654e78ec6941bbbbd9fbcf538c5ee0567d. Предположение: поскольку локальный main содержит 68 новых коммитов поверх origin/main, сохранить их обязательно. Review A/B/C обнаружены как untracked в первоначальном worktree, не в Git main.
