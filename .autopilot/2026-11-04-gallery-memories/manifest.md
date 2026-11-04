# Требования

| ID | Требование | Статус | Где |
|---|---|---|---|
| R01 | Явный порядок 21 события из брифа, планетарий последний | done | T01, T02 |
| R02 | Источник images из main, не перемещать исходники | done | T01, T02; D01 |
| R03 | Пропускать отсутствующие папки и уплотнять порядок | done | T01, T02 |
| R04 | Пустая существующая папка: заглушка (противоречит R05) | deferred | Противоречие: позднее указание R05, принято пропускать |
| R05 | Пустые папки пропускать и уплотнять порядок | done | T01, T02 |
| R06 | Одна картина на событие, увеличить галерею | done | T01, T02 |
| R07 | Чередовать стороны и пары по направлению камеры | done | T01, T02 |
| R08 | Нумерация 1–4 определяет позиции, fallback стабильный | done | T01, T02 |
| R09 | Главная видна при прогулке | done | T01, T02 |
| R10 | Дополнительные 2–4 появляются из частиц при фокусе в заданной раскладке | done | T01, T02 |
| R11 | Нет пустых рамок, коллаж не перекрывает проход | done | T01, T02 |
| R12 | Сохранить фокус, камеру, свет и переход к галактике | done | T01, T02 |
| R13 | Подписи в JSON по ID папки; перенести существующие | done | T01, T02 |
| R14 | Пустые подписи не отображаются и JSON редактируется отдельно | done | T01, T02 |
| R15 | Проверить ошибки отсутствующих файлов и работоспособность | done | T01, T02 |
| R16 | Commit и push в текущую ветку, сообщить файлы | done | T01, T02; commit and push to current branch |


## Discoveries

| ID | Finding | Decision | Requirement |
|---|---|---|---|
| D01 | T01 found matching photo folders in the sibling local worktree `feature/scene-04-vortex-portrait`; `origin/main` still lacks the event folders. | 74 JPGs were copied unchanged into this branch's `images/<ID>/`; originals remain untouched. R02 remains live, with local source provenance recorded as an assumption. | R02 |
