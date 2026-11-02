window.STATE =
{
  "slug": "gallery-thin-water",
  "dir": "2026-11-02-gallery-thin-water",
  "title": "Тонкий слой воды · сцена 05",
  "mode": "full",
  "depth": "normal",
  "polish": null,
  "tier": "T1",
  "briefFile": "2026-11-02-brief.md",
  "memoryFile": "AGENTS.md",
  "skillDir": "C:/Users/McHomak/.agents/skills/autopilot",
  "startedAt": "2026-11-02T01:16:54+03:00",
  "updatedAt": "2026-11-02T04:47:03+03:00",
  "finishedAt": "2026-11-02T04:47:03+03:00",
  "stages": [
    {
      "id": "preflight",
      "status": "done",
      "startedAt": "2026-11-02T01:16:54+03:00",
      "finishedAt": "2026-11-02T04:47:03+03:00"
    },
    {
      "id": "manifest",
      "status": "done",
      "startedAt": "2026-11-02T01:16:54+03:00",
      "finishedAt": "2026-11-02T04:47:03+03:00"
    },
    {
      "id": "briefing",
      "status": "skipped",
      "note": "полный автомат — самобрифинг"
    },
    {
      "id": "spec",
      "status": "done",
      "startedAt": "2026-11-02T01:16:54+03:00",
      "finishedAt": "2026-11-02T04:47:03+03:00"
    },
    {
      "id": "plan",
      "status": "done",
      "startedAt": "2026-11-02T01:18:07+03:00",
      "finishedAt": "2026-11-02T04:47:03+03:00"
    },
    {
      "id": "build",
      "status": "done",
      "startedAt": "2026-11-02T01:18:07+03:00",
      "finishedAt": "2026-11-02T04:47:03+03:00"
    },
    {
      "id": "review",
      "status": "done",
      "startedAt": "2026-11-02T01:45:18+03:00",
      "finishedAt": "2026-11-02T04:47:03+03:00"
    },
    {
      "id": "final",
      "status": "done",
      "finishedAt": "2026-11-02T04:47:03+03:00"
    }
  ],
  "requirements": {
    "total": 18,
    "done": 18,
    "inTicket": 0,
    "inSpec": 0,
    "placeholder": 0,
    "deferred": 0,
    "dropped": 0
  },
  "tickets": [
    {
      "id": "01",
      "title": "Параметры воды",
      "requirements": [
        "R09",
        "R10",
        "R11",
        "R12",
        "R13",
        "R14",
        "R15"
      ],
      "blockedBy": [],
      "wave": 1,
      "zone": [
        "scene-config",
        "DeveloperPanel"
      ],
      "status": "done",
      "startedAt": "2026-11-02T01:18:07+03:00",
      "retries": 0,
      "repairs": 0,
      "handoffs": 0,
      "finishedAt": "2026-11-02T04:47:03+03:00",
      "commit": "475e665",
      "tests": {
        "passed": 429,
        "failed": 0
      }
    },
    {
      "id": "02",
      "title": "Вода и реальные отражения",
      "requirements": [
        "R01",
        "R02",
        "R03",
        "R04",
        "R05",
        "R06",
        "R07",
        "R08",
        "R16",
        "R17",
        "R18"
      ],
      "blockedBy": [],
      "wave": 1,
      "zone": [
        "gallery",
        "GalleryScene"
      ],
      "status": "done",
      "retries": 0,
      "repairs": 1,
      "handoffs": 0,
      "startedAt": "2026-11-02T01:35:27+03:00",
      "repairFindings": [
        "Первый браузерный кадр: отражения не видны; двойное преобразование world position в textureMatrix. Исправить и подтвердить визуально."
      ],
      "finishedAt": "2026-11-02T04:47:03+03:00",
      "commit": "d2f114f",
      "tests": {
        "passed": 429,
        "failed": 0
      }
    }
  ],
  "singlePass": null,
  "tests": {
    "passed": 429,
    "failed": 0,
    "files": 91,
    "lint": "passed",
    "typecheck": "passed",
    "build": "passed"
  },
  "debt": {
    "placeholders": [],
    "assumptions": [
      "Продолжение ветки ночной палитры 7a92f50; RT standard 1024"
    ],
    "emptyEnv": []
  },
  "additions": [],
  "coverage": {
    "found": 4,
    "fixed": 4,
    "deferred": 0
  },
  "concerns": [
    "1024 standard RT,512 low; physical M2/Safari unmeasured",
    "Soft distant blue wash and moon path are next artistic tuning; no blockers"
  ],
  "reviewers": {
    "manifestSpec": "/root/water_spec_review",
    "craft": "/root/review"
  },
  "blind": {
    "verdict": "accepted first water pass",
    "blocking": 0,
    "notes": [
      "Distant soft blue wash and moon path tuning remain next artistic pass"
    ]
  }
}