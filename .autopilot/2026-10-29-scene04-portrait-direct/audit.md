# Аудит перед изменением

2026-10-29; worktree C:/Users/McHomak/Projects/A_Little_Universe_scene04_direct; branch codex/scene04-portrait-direct; committed base 01c4d925e1a493d50120405e3cabe87c65187997. Root/branch/HEAD/status/worktree list/log проверены до creation. Main имеет много незакоммиченных изменений; ни одна не переносилась. Существующая ../A_Little_Universe_scene04 занята веткой autopilot/scene-04; новый путь свободен. New-tree git status --short был пуст.

## Реальный baseline
- filmConfig.TIMING.identity: 34s, flower0–4, particles4–8, name8–13, morph13–17, portrait17–23, photo23–34, caption28–34.
- IdentityScene: GPU origin→vortex→name→sampled glyph field; makeAscii plane; original photo underlay .35 by20/full28; orbit lines/trails, Spark, соседние placeholder photos.
- Exact photo frontend/src/assets/start_img.jpg, tracked copy images/start_img.jpg; hashes identical. Square image grayscale.
- SceneDirector selects keyed scene/revision; bloom procedural Lily unmounts, identity renders same current primitive anew. No GLB handoff. LilyParticleSource.sample only positions; mock disk source. Final GLB same-object dissolve pending.
- CameraDirector bloom finishes flowerTop=(1.7,4.5,4), target=(0,.2,0). Identity eases front=(0,0,5.6), target0. Gallery first photo uses same FirstMemoryCard at world(0,.08,0); scale1; plane2.15²; frame2.23². Boundary remounts objects; visual alignment contract, not persistent-object transfer.
- film reducer bloom complete→identity playing, identity complete→gallery exploring. Shared GSAP runtime controls time/pause/speed/seek; useSceneTimeline subscriptions and resource disposal already available.
- Tests colocated Vitest: identityFrame/identityRuntime/identityVortex, film transitions, galleryMotion. Baseline npm ci succeeds; npm run check 106 tests/27 files +lint/typecheck/build passes. Node24.11.1.

## Реальные browser baseline снимки
Dev server из этой worktree http://127.0.0.1:5184/?debug, strictPort. Playwright viewport1024×768, scene-jump identity, pause, DEV seek. Скрыта только панель DEV и toggle через temporary CSS. t2/17/20/23/28/34 в docs/verification/scene04-portrait-direct/baseline/. На17 лицо тёмное под точечным полем; на20 photo underlay делает его узнаваемее при всё ещё жёстком квадрате. Не утверждаем воспроизведение иной динамики из отсутствующих пользовательских screenshots. Снимки относятся к committed baseline.

## Подготовка Autopilot
T1, один плотный таск: отдельные timeline/renderer таски пересекаются по файлам и поодиночке не демонстрируют новую последовательность. G1 zero open; G2 independent brief/spec check нашёл8 пробелов, spec уточнена, повторный check clean; G3 все42 R→01, 01→R. Root orchestrates; named worker implements; independent review and final acceptance separate.
Dashboard template+sync copied. sync.py default server fails on Windows (FileNotFoundError ps); --no-serve snapshot succeeds; local dashboard opened via OS. No dashboard server started, no unrelated process touched.
