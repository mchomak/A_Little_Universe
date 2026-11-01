# HANDOFF 03-1

## РЕШЕНИЯ

DEV-страница `/dev/particle-portrait` подключена только через lazy DEV-ветку в `frontend/src/main.tsx`; она использует существующие sampler/material seam, загружает исходное фото и matte, держит статичные точки в одном fixed 4:3 R3F Canvas, переключает DOM-фото и частицы и предоставляет настройки/storage/JSON fallback. Изменённые файлы: `frontend/src/main.tsx`; `frontend/src/particle-portrait-lab/ParticlePortraitLab.tsx`; `frontend/src/particle-portrait-lab/config.ts`; `frontend/src/particle-portrait-lab/config.test.ts`; `frontend/src/particle-portrait-lab/particle-portrait-lab.css`. Scene 04 не редактировалась. Focused test: `npm test -- src/particle-portrait-lab/config.test.ts` — 8 passed. Build: `npm run build` — passed. В Chrome осмотрен `http://127.0.0.1:5174/dev/particle-portrait` при 1024×768; preview оказался 4:3, фото/частицы переключались, console errors не было (только существующее предупреждение `THREE.Clock`). Скриншоты были получены в живой вкладке через Chrome DevTools.

## ТУПИКИ

В particle-mode лицо и внутренние черты выглядят тускло; итоговую узнаваемость по R22.1 нельзя считать проверенной. `mcp__chrome_devtools__fill_form` по range-ползункам переместил только DOM thumb: React state, подписи и localStorage не изменились. Два синтетических `input` dispatch из DevTools тоже не вызвали React handler; это не подтверждает поломку при реальном pointer input. Физический iPad/Safari не проверялся. В `.autopilot` до handoff уже были изменения координатора; я их не редактировал.

## ДАЛЬШЕ

Сначала проверь один параметр настоящим pointer drag/click в браузере при 1024×768: после изменения яркости должны одновременно обновиться значение подписи, versioned localStorage и интенсивность точек; затем сбрось настройки к defaults и зафиксируй чистый скриншот фото/портрет в одном кадре. По этому скриншоту оцени читаемость глаз, носа, губ, волос и теней; если детали остаются тусклыми, настрой только отображение/диапазоны панели и вызов общей appearance-функции внутри lab, не меняя shared shader, sampler, Scene 04 или таймлайн. Повтори focused test, `npm run build` и проверь console после правок.
