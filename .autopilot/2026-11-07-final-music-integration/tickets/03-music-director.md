# 03 — Каталог, плейлист и crossfade MusicDirector

**Требования:** R01, R05–R11, R14, R16–R18, R23–R49, R65–R71, R75, R79
**Blocked by:** 01, 02
**Зона:** `frontend/src/systems/audio/`
**Волна:** 2
**Status:** ready

## Что должно заработать

Один `MusicDirector` управляет Intro, бесконечной галерейной партитурой и Outro. Существуют централизованный каталог с каноническими URL/offset/track gain, отдельное версионированное хранилище настроек, две переиспользуемые media slots и детерминированный crossfade. Логика пригодна для вызова из film lifecycle и управляется короткими тестами.

## Из брифа, дословно

> «Начало фильма: `In the Pool` — Kensuke Ushio»
> «Галерея — строго в таком порядке: Hania Rani — Glass; Ludovico Einaudi — Nuvole Bianche; Vicente Amigo — Tres Notas para Decir Te Quiero; Patrick Watson — Je te laisserai des mots; Air — La femme d'argent.»
> «Финал: M83 — Outro.»
> «Реализуй crossfade двух аудиопотоков.»

## Разделы спецификации

Истории 1–6; решения 2–10; границы `MusicDirector` и `musicSettings`.

## Критерии приёмки

- [ ] `MUSIC_CONFIG` содержит ровно выбранный Intro, пять gallery tracks в указанном порядке и M83 Outro с понятными именами, локальными путями, offset, track gain, group/master defaults и fade timings. Missing asset не блокирует director.
- [ ] Intro запускается в первом разрешённом запуске фильма с `startOffset: 68` по умолчанию, сохраняется через сцены 01–04, не loop'ится и аккуратно завершается, если длительность трека не покрыла фильм. Раскрытие бутона — музыкальная кульминация около участка 2:05–2:35; анимации не меняются.
- [ ] При переходе в галерею Intro плавно уступает первому треку. Воспроизведение идёт по всем пяти трекам, после пятого возвращается к первому, выбор/фокус фотографий не меняет текущий трек.
- [ ] Текущий медиа-слот не более одного плюс один заранее подготовленный следующий. Слоты, event listeners и timer/automation очищаются/отменяются при switch, error и dispose.
- [ ] Четыре профиля crossfade по умолчанию: Intro→Gallery 8 с, обычный gallery→gallery 7 с, loop 8 с, Gallery→Outro 10 с. Equal-power `cos/sin` automation и смена track вручную отменяют старый fade без второго наложенного перехода.
- [ ] `handleGalleryExit` с `outroStartOffset: 0` начинает M83 от события выхода из последнего planetarium photo, а не времени фильма. Cosmos/greeting/ending сохраняют тот же проигрываемый экземпляр и не запускают новый трек.
- [ ] Возвратная галерея из ending не запускает Outro повторно; direct DEV sync/skip и replay детерминированы; M83 не повторяется, а galaxy/app продолжают работу после её окончания.
- [ ] Ошибка autoplay, decode, 404, неактуальное async событие или отсутствующий файл не меняют состояние фильма; ошибки доступны в snapshot/diagnostics без повтора Intro/Outro.
- [ ] Если `enabled` выключен, same-group `syncFilmState` или `resume()` не теряет намерение пользователя; повторное включение после этих событий возобновляет текущий/целевой трек без дубликата.
- [ ] Во время crossfade snapshot `nextTrack` указывает реальный следующий playlist item или `null`, но никогда outgoing track.
- [ ] Local music settings ограничивают и нормализуют значения в ключе `a-little-universe:music:v1`; повреждённый storage безопасен и не меняет Scene Composer presets.
- [ ] Управляемые unit tests проверяют intro continuity, последовательность и loop, фото focus без restart, выход в Outro, сохранение Outro после смены сцен, crossfade cancellation, ошибки, skip/replay, настройки и конец M83 без повторения; оригинальные длительные файлы не нужны для тестов.

## Ограничения

Музыкальные тайминги не управляют скоростью сцен; никаких network sources, новых тяжёлых библиотек, visual/scene edits или изменения MP3.
