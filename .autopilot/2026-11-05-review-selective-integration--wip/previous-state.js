window.STATE =
{
  "slug": "scene-presets",
  "dir": "2026-11-03-scene-presets--wip",
  "title": "Пресеты настроек сцен",
  "mode": "full",
  "depth": "normal",
  "polish": null,
  "tier": "T2",
  "briefFile": "2026-11-03-brief.md",
  "memoryFile": "AGENTS.md",
  "skillDir": "C:/Users/McHomak/.agents/skills/autopilot",
  "startedAt": "2026-11-03T17:55:00+03:00",
  "updatedAt": "2026-11-03T19:45:22+03:00",
  "finishedAt": "2026-11-03T19:45:22+03:00",
  "stages": [
    {
      "id": "preflight",
      "status": "done",
      "startedAt": "2026-11-03T17:55:00+03:00",
      "finishedAt": "2026-11-03T18:02:20+03:00"
    },
    {
      "id": "manifest",
      "status": "done",
      "startedAt": "2026-11-03T18:02:20+03:00",
      "finishedAt": "2026-11-03T18:03:54+03:00"
    },
    {
      "id": "briefing",
      "status": "skipped",
      "note": "полный автомат — самобрифинг"
    },
    {
      "id": "spec",
      "status": "done",
      "startedAt": "2026-11-03T18:03:54+03:00",
      "finishedAt": "2026-11-03T18:19:49+03:00"
    },
    {
      "id": "plan",
      "status": "done",
      "startedAt": "2026-11-03T18:19:49+03:00",
      "finishedAt": "2026-11-03T18:24:23+03:00",
      "note": "4 таска, ярус T2"
    },
    {
      "id": "build",
      "status": "done",
      "startedAt": "2026-11-03T18:24:23+03:00",
      "note": "Таск 01 из 4 — формат пресета и снимок сцены",
      "finishedAt": "2026-11-03T19:45:22+03:00"
    },
    {
      "id": "review",
      "status": "done",
      "finishedAt": "2026-11-03T19:45:22+03:00"
    },
    {
      "id": "final",
      "status": "done",
      "finishedAt": "2026-11-03T19:45:22+03:00"
    }
  ],
  "requirements": {
    "total": 5,
    "done": 5,
    "inTicket": 0,
    "inSpec": 0,
    "placeholder": 0,
    "deferred": 0,
    "dropped": 0
  },
  "tickets": [
    {
      "id": "01",
      "title": "Формат и преобразование полного пресета сцены",
      "requirements": [
        "R02",
        "R04",
        "R05"
      ],
      "blockedBy": [],
      "wave": 1,
      "zone": [
        "frontend/src/debug/scenePresetModel.ts"
      ],
      "status": "done",
      "retries": 0,
      "repairs": 0,
      "handoffs": 0,
      "startedAt": "2026-11-03T18:35:32+03:00",
      "finishedAt": "2026-11-03T19:45:22+03:00"
    },
    {
      "id": "02",
      "title": "Файловое хранилище и локальный API пресетов",
      "requirements": [
        "R03",
        "R05",
        "R03.1",
        "R03.2"
      ],
      "blockedBy": [
        "01"
      ],
      "wave": 2,
      "zone": [
        "frontend/dev-scene-preset-store.ts",
        "frontend/vite.config.ts"
      ],
      "status": "done",
      "retries": 0,
      "repairs": 0,
      "handoffs": 0,
      "finishedAt": "2026-11-03T19:45:22+03:00"
    },
    {
      "id": "03",
      "title": "Управление пресетами в Scene Editor",
      "requirements": [
        "R01",
        "R03",
        "R04",
        "R01.1",
        "R03.1",
        "R03.2"
      ],
      "blockedBy": [
        "02"
      ],
      "wave": 3,
      "zone": [
        "frontend/src/debug/scenePresetApi.ts",
        "frontend/src/debug/ScenePresetControls.tsx"
      ],
      "status": "done",
      "retries": 0,
      "repairs": 0,
      "handoffs": 0,
      "finishedAt": "2026-11-03T19:45:22+03:00"
    },
    {
      "id": "04",
      "title": "Снимок и применение пресета выбранной сцены",
      "requirements": [
        "R01",
        "R02",
        "R04",
        "R05",
        "R04.1"
      ],
      "blockedBy": [
        "03"
      ],
      "wave": 4,
      "zone": [
        "frontend/src/debug/DeveloperPanel.tsx"
      ],
      "status": "done",
      "retries": 0,
      "repairs": 0,
      "handoffs": 0,
      "finishedAt": "2026-11-03T19:45:22+03:00"
    }
  ],
  "singlePass": null,
  "tests": "npm run check: 566 tests, lint, typecheck, build passed",
  "debt": {
    "placeholders": [],
    "assumptions": [],
    "emptyEnv": []
  },
  "additions": [],
  "coverage": {
    "found": 1,
    "fixed": 1,
    "deferred": 0,
    "findings": [
      "Независимая проверка: пропусков нет; половинчатых требований нет; все уточнения привязаны к R01–R05. Удалён лишний список не запрошенных функций из раздела «Вне рамок»."
    ]
  },
  "concerns": [],
  "reviewers": {
    "manifestSpec": null,
    "craft": null
  },
  "blind": {
    "status": "passed",
    "detail": "Browser: save, reload, apply, undo and redo verified for scene and background."
  }
}
