window.STATE =
{
  "slug": "portrait-particle-matching",
  "dir": "2026-11-03-portrait-particle-matching",
  "title": "Детальный портрет и подготовка частиц",
  "mode": "full",
  "depth": "normal",
  "polish": null,
  "tier": "T1",
  "briefFile": "2026-11-03-brief.md",
  "memoryFile": "AGENTS.md",
  "skillDir": "C:/Users/McHomak/.agents/skills/autopilot",
  "startedAt": "2026-11-03T17:38:09+03:00",
  "updatedAt": "2026-11-04T04:15:32+03:00",
  "finishedAt": "2026-11-04T04:15:32+03:00",
  "stages": [
    {
      "id": "preflight",
      "status": "done",
      "startedAt": "2026-11-03T17:38:09+03:00",
      "finishedAt": "2026-11-03T17:38:59+03:00"
    },
    {
      "id": "manifest",
      "status": "done",
      "startedAt": "2026-11-03T17:38:59+03:00",
      "finishedAt": "2026-11-03T17:38:59+03:00"
    },
    {
      "id": "briefing",
      "status": "skipped",
      "startedAt": "2026-11-03T17:38:59+03:00",
      "note": "полный автомат — самобрифинг",
      "finishedAt": "2026-11-03T17:39:36+03:00"
    },
    {
      "id": "spec",
      "status": "done",
      "startedAt": "2026-11-03T17:39:36+03:00",
      "finishedAt": "2026-11-03T17:43:41+03:00"
    },
    {
      "id": "plan",
      "status": "done",
      "startedAt": "2026-11-03T17:43:41+03:00",
      "finishedAt": "2026-11-03T17:43:41+03:00",
      "note": "T1 — два таска"
    },
    {
      "id": "build",
      "status": "done",
      "startedAt": "2026-11-03T17:43:41+03:00",
      "finishedAt": "2026-11-04T03:40:09+03:00"
    },
    {
      "id": "review",
      "status": "done",
      "startedAt": "2026-11-04T03:40:09+03:00",
      "finishedAt": "2026-11-04T03:40:09+03:00"
    },
    {
      "id": "final",
      "status": "done",
      "startedAt": "2026-11-04T03:40:09+03:00",
      "finishedAt": "2026-11-04T04:15:32+03:00"
    }
  ],
  "requirements": {
    "total": 8,
    "done": 8,
    "inTicket": 0,
    "inSpec": 0,
    "placeholder": 0,
    "deferred": 0,
    "dropped": 0
  },
  "tickets": [
    {
      "id": "01",
      "title": "Подбор частиц к портрету",
      "requirements": [
        "R01",
        "R02",
        "R06",
        "R07",
        "R08i"
      ],
      "blockedBy": [],
      "wave": 1,
      "zone": [
        "frontend/src/scenes/lily/dissolve.ts",
        "frontend/src/systems/scene-config/"
      ],
      "status": "done",
      "startedAt": "2026-11-03T17:43:41+03:00",
      "retries": 0,
      "repairs": 1,
      "handoffs": 0,
      "finishedAt": "2026-11-04T03:40:09+03:00",
      "commit": "4c36f76"
    },
    {
      "id": "02",
      "title": "Ранняя подготовка и DEV-индикатор",
      "requirements": [
        "R03",
        "R04",
        "R05"
      ],
      "blockedBy": [],
      "wave": 1,
      "zone": [
        "frontend/src/app/",
        "frontend/src/bootstrap/",
        "frontend/src/scenes/lily/ (worker и интеграция)"
      ],
      "status": "done",
      "startedAt": "2026-11-03T17:43:41+03:00",
      "retries": 0,
      "repairs": 1,
      "handoffs": 0,
      "finishedAt": "2026-11-04T03:40:09+03:00",
      "commit": "16c41c6"
    }
  ],
  "singlePass": null,
  "tests": {
    "status": "passed",
    "command": "npm run check",
    "total": 577
  },
  "debt": {
    "placeholders": [],
    "assumptions": [],
    "emptyEnv": []
  },
  "additions": [],
  "coverage": {
    "found": 0,
    "fixed": 0,
    "detail": "независимая сверка брифа и спецификации"
  },
  "concerns": [
    "Реальная модель, 1280×716: все 32 000 точек, 78,36% посадок до 12 с; после оптимизации worker около 10 с, полная подготовка в отдельном браузерном прогоне 34 с.",
    "Браузерная проверка DEV-перерасчёта: source переиспользован, создан один worker, индикатор исчез после готовности; итоговый check запущен."
  ],
  "reviewers": {
    "manifestSpec": null,
    "craft": "/root/prep_craft_review"
  },
  "blind": {
    "status": "passed",
    "detail": "Независимая приёмка подтвердила подготовку и сохранение точек; перекрытие с распадом цветка дополнительно измерено на реальной модели."
  }
}
