# Проверки

## До изменений
- `npm test` (frontend):167 passed,47 files. Node/Three deprecated CJS и Vite config native warnings существовали до этой доработки.
- Диагностика кода: CSS breathing вне clock;44px touch-target; жёсткий polygon sweep;450 независимых glyph samples на1800 vertices; самостоятельные DOM/WebGL core на границе01→02.
- Playwright Chromium: WebGL2 доступен, один WebGL canvas; штатная кнопка pause перекрывалась canvas. Отдельный Chrome DevTools браузер WebGL2 не создал, потому используется Playwright.
- Baseline hold сохранён `baseline-hold.png` (после нового copy/timing контракта, до новыхvisuals).

## Контракт01
- Focused7files36 tests passed; lint/typecheck passed.
- Независимые Manifest/Spec и Craft reviewers:clean. Переход.85с captured; waiting canonical18 и presentation из общегоGSAP clock; backward compatible schema2.
- Full suite до consumers имела ожидаемые устаревшие timing assertions; их закрывают01/02/03.

## Возобновление
- После прерывания по usage limit: неполные redtests letterMatter/lightPose сохранены, исполнители02/03 возобновлены.
- `npm test`:172pass,3failed tests +2 failed suites (ожидаемые missing modules в процессеTDD, stale Overlay/Composer assertions). Не считается завершённой проверкой.

## План браузерной проверки
`browser-frames.js`:1180×820,820×1180,1440×900; времена1/4/9/12/13/14/15/16/17.99, exact-time replayPNG equality; настоящий pause click; один canvas, light geometry, layout metrics. Отдельно gate18, touch midpoint/growth handoff, low, reduced motion и production.

## Выполненная визуальная проверка
- Итоговый sweep1180×820/820×1180/1440×900 сохранён. WebGL canvas один, геометрический центрlight совпадаетviewport; читаемые верхняя/нижняя фразы, меньший второйкегль. Screenshot14 после2→15→0→9→14 байт-в-байт совпадает.
- Первый вариант13 имел вытянутые горизонтальные fracture gaps; исправлены isotropic local islands. Слишком слабая dust14/15 усилена смешанными softsprites и редкими более крупными акцентами, после чего повторно просмотрены кадры.
- На16 текст/dust отсутствуют, на17.99 приглашение близко кцентру, ядро не перекрыто.
- Gate удержан, pointer activation на50CSSpx отцентра принят. Скорость.25 использована дляcapture touch-final0–6; вphaseprologue одна тонкая волна/pearl dust, затемgrowth безblackframe/скачкапозицииcore. Нацеленной scene02 художественной переработки нет.
- Браузерное окно необходимо bringToFront: occlusion ограничиваетRAF примерно1/s и GSAP lagsmoothing замедляетчасы; foreground измерено103RAF/1s. Это не tabletGPU benchmark.
- Первый batchdeterminismfalse был вовремяHMR/resize; stable reruntrue с500ms rebuildwait. Final reload browserconsole noerrors, optional sameoriginscene-composer404 warning остается.
- Review нашёл readycore смещение невидимыми gridspans; исправлено conditional dustrender сregressiontest. DPR-only memoization исправлена подпискойR3Fviewport.dpr.

## Проверки во время параллельной работы Iris Lab
- После интеграции до новыхirisправок:180tests/50files, lint,typecheck,productionbuild passed (исполнитель03).
- Root последующий `npm run check`:lintpass,182pass/1fail, failedsrc/iris-lab/config.test.ts version3 expected,2actual. Earlier typecheckerrors менялись с concurrent edits (missingirisColorMaskGlsl/IrisColorGrading). Это внеизмененийпролога; не исправлялось этимзапуском. Финальный статус будет записанпосле последнегопрогона.

## Финальная проверка
- Root `npm run check`16:27:44: **191 tests/50files passed**, ESLint, strictTypeScript и Viteproductionbuildpassed. Параллельные IrisLab ошибки устранены тойработой до этого прогона; этотзапуск ихнеисправлял.
- Остались предупреждения существующегостека: ThreeCJS deprecated, Vite future native config extension compatibility, Appchunk758.85kB >500kB. Не ошибкаbuild.
- `quality-review.cjs` запущен с ужеустановленным Playwright из MCP cache (безустановкизависимостей), отдельныйheadless Chromium: no pageerrors. ПриdeviceScaleFactor2 canvasменялся1180×820→1770×1230 сDPR1→1.5; lowвозвращает1180×820. Low14/reduced12/14/17.99 screenshots просмотрены: вreducedтекстчитаем, активнаяпыль отсутствует.
- Productionpreview4173 с?debug: **0DEVэлементов,1WebGLcanvas**; обычныйpointerclickPauseработает иPNGpausedпобайтнонеизменен спустя500ms. Productionbundle успешно загружается.
- НезависимаяG4 реально прошла no-permissions→gift→gate18→keyboardpause→Enterlight→reaction→growth, одинcanvas. Подтверждённыхфункциональныхблокеровпролога нет. Еёпокадровыйартпросмотрограничен; полныйsweepиtouchсерия выполненыroot.
- Непроверено: физическийiPad/Safari, аппаратнаяtabletпроизводительность, одновременнаязапись/film/offline наустройстве. Новыхаудиофайловнет, cuesподготовлены. Scene02остаётсяисходнымplaceholder.
- Последняя правка DEVслоя: nativepointerPause1024×768 теперьдоступна, не перекрываетсяTimeline; productionпозициясохранена. Послеэтойправки повторный`npm run check`16:29:36:191/50,lint,typecheck,productionbuildpassed. Повторныйqualityrunner завершился0, noerrors, devPauseAccessibletrue, prodpauseStabletrue.
