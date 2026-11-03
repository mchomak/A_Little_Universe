window.STATE =
{
  "slug": "macbook-production",
  "dir": "2026-11-03-macbook-production",
  "title": "Показ на MacBook и плавность сцен",
  "mode": "full",
  "depth": "normal",
  "polish": null,
  "tier": "T1",
  "briefFile": "2026-11-03-brief.md",
  "memoryFile": "AGENTS.md",
  "skillDir": "C:/Users/McHomak/.agents/skills/autopilot",
  "startedAt": "2026-11-03T14:53:22+03:00",
  "updatedAt": "2026-11-03T15:18:43+03:00",
  "finishedAt": "2026-11-03T15:18:43+03:00",
  "stages": [
    {
      "id": "preflight",
      "status": "done",
      "finishedAt": "2026-11-03T15:18:43+03:00"
    },
    {
      "id": "manifest",
      "status": "done",
      "finishedAt": "2026-11-03T15:18:43+03:00"
    },
    {
      "id": "briefing",
      "status": "skipped",
      "note": "полный автомат — самобрифинг"
    },
    {
      "id": "spec",
      "status": "done",
      "finishedAt": "2026-11-03T15:18:43+03:00"
    },
    {
      "id": "plan",
      "status": "done",
      "finishedAt": "2026-11-03T15:18:43+03:00"
    },
    {
      "id": "build",
      "status": "done",
      "startedAt": "2026-11-03T14:56:36+03:00",
      "finishedAt": "2026-11-03T15:18:43+03:00"
    },
    {
      "id": "review",
      "status": "done",
      "finishedAt": "2026-11-03T15:18:43+03:00"
    },
    {
      "id": "final",
      "status": "done",
      "finishedAt": "2026-11-03T15:18:43+03:00"
    }
  ],
  "requirements": {
    "total": 9,
    "done": 9,
    "inTicket": 0,
    "inSpec": 0,
    "placeholder": 0,
    "deferred": 0,
    "dropped": 0
  },
  "tickets": [
    {
      "id": "01",
      "title": "Удаление подготовки и инструкции",
      "requirements": [
        "R02",
        "R03"
      ],
      "blockedBy": [],
      "wave": 1,
      "zone": [
        "Запуск и документация"
      ],
      "status": "done",
      "startedAt": "2026-11-03T14:56:36+03:00",
      "retries": 0,
      "repairs": 0,
      "handoffs": 0,
      "finishedAt": "2026-11-03T15:18:43+03:00"
    },
    {
      "id": "02",
      "title": "Переход и взаимодействие",
      "requirements": [
        "R07",
        "R08"
      ],
      "blockedBy": [],
      "wave": 1,
      "zone": [
        "Сцены 02–03"
      ],
      "status": "done",
      "startedAt": "2026-11-03T14:56:36+03:00",
      "retries": 0,
      "repairs": 0,
      "handoffs": 0,
      "finishedAt": "2026-11-03T15:18:43+03:00"
    },
    {
      "id": "03",
      "title": "Движение фона",
      "requirements": [
        "R04",
        "R05",
        "R06"
      ],
      "blockedBy": [],
      "wave": 1,
      "zone": [
        "Фон"
      ],
      "status": "done",
      "startedAt": "2026-11-03T14:56:36+03:00",
      "retries": 0,
      "repairs": 0,
      "handoffs": 0,
      "finishedAt": "2026-11-03T15:18:43+03:00"
    }
  ],
  "singlePass": null,
  "tests": {
    "passed": 553,
    "failed": 0
  },
  "debt": {
    "placeholders": [],
    "assumptions": [
      "Перемещение фона реализовано как панорамирование видимой области статичного изображения."
    ],
    "emptyEnv": []
  },
  "additions": [],
  "coverage": {
    "found": 2,
    "fixed": 2,
    "deferred": 0
  },
  "concerns": [],
  "reviewers": {
    "manifestSpec": null,
    "craft": null
  },
  "blind": {
    "result": "Приёмка по брифу: устаревшая запись AGENTS.md исправлена; визуальная проверка на MacBook остаётся открытой."
  }
}
