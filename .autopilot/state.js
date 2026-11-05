window.STATE =
{
  "slug": "macbook-native-release",
  "dir": "2026-11-05-macbook-native-release--wip",
  "title": "macOS приложение и локальная запись",
  "mode": "full",
  "depth": "normal",
  "polish": null,
  "tier": "T2",
  "briefFile": "2026-11-05-brief.md",
  "memoryFile": "AGENTS.md",
  "skillDir": "C:/Users/McHomak/.agents/skills/autopilot",
  "startedAt": "2026-11-05T16:34:30+03:00",
  "updatedAt": "2026-11-05T22:18:18+03:00",
  "finishedAt": null,
  "stages": [
    {
      "id": "preflight",
      "status": "done",
      "startedAt": "2026-11-05T16:34:30+03:00",
      "finishedAt": "2026-11-05T16:34:30+03:00"
    },
    {
      "id": "manifest",
      "status": "done",
      "startedAt": "2026-11-05T16:34:30+03:00",
      "finishedAt": "2026-11-05T16:35:10+03:00"
    },
    {
      "id": "briefing",
      "status": "skipped",
      "note": "полный автомат — самобрифинг"
    },
    {
      "id": "spec",
      "status": "done",
      "startedAt": "2026-11-05T16:35:10+03:00",
      "finishedAt": "2026-11-05T16:36:15+03:00"
    },
    {
      "id": "plan",
      "status": "done",
      "startedAt": "2026-11-05T16:36:15+03:00",
      "finishedAt": "2026-11-05T16:36:15+03:00",
      "note": "3 последовательных этапа"
    },
    {
      "id": "build",
      "status": "active",
      "startedAt": "2026-11-05T16:36:15+03:00"
    },
    {
      "id": "review",
      "status": "active",
      "startedAt": "2026-11-05T22:18:18+03:00"
    },
    {
      "id": "final",
      "status": "pending"
    }
  ],
  "requirements": {
    "total": 106,
    "done": 0,
    "inTicket": 106,
    "inSpec": 0,
    "placeholder": 0,
    "deferred": 0,
    "dropped": 0
  },
  "tickets": [
    {
      "id": "01",
      "title": "Автономное macOS приложение",
      "requirements": [
        "R01"
      ],
      "blockedBy": [],
      "wave": 1,
      "zone": [
        "desktop",
        "frontend"
      ],
      "status": "done",
      "retries": 0,
      "repairs": 0,
      "handoffs": 0,
      "startedAt": "2026-11-05T16:36:21+03:00",
      "finishedAt": "2026-11-05T17:19:04+03:00",
      "tests": {
        "passed": 764,
        "failed": 0
      },
      "concerns": [
        "Сборка и запуск macOS ARM64 требуют macOS; на Windows не проверены."
      ]
    },
    {
      "id": "02",
      "title": "Подтверждение и независимая запись",
      "requirements": [
        "R01"
      ],
      "blockedBy": [
        "01"
      ],
      "wave": 2,
      "zone": [
        "desktop",
        "frontend"
      ],
      "status": "done",
      "retries": 0,
      "repairs": 2,
      "handoffs": 0,
      "startedAt": "2026-11-05T17:19:04+03:00",
      "finishedAt": "2026-11-05T18:21:43+03:00",
      "tests": {
        "passed": 781,
        "failed": 0
      },
      "concerns": [
        "Реальный захват и воспроизводимость сегментов на macOS требуют проверки."
      ]
    },
    {
      "id": "03",
      "title": "Объединение, восстановление и проверки",
      "requirements": [
        "R01"
      ],
      "blockedBy": [
        "02"
      ],
      "wave": 3,
      "zone": [
        "desktop",
        "frontend"
      ],
      "status": "review",
      "retries": 0,
      "repairs": 2,
      "handoffs": 0,
      "startedAt": "2026-11-05T18:21:43+03:00",
      "tests": {
        "passed": 805,
        "failed": 0
      }
    }
  ],
  "singlePass": null,
  "tests": null,
  "debt": {
    "placeholders": [],
    "assumptions": [
      "Локальный main d631793 выбран как актуальный, он опережает origin/main на 68 коммитов."
    ],
    "emptyEnv": []
  },
  "additions": [],
  "coverage": {
    "found": 8,
    "fixed": 8,
    "deferred": 0
  },
  "concerns": [
    "Первый этап: ARM64 .app и разрешения macOS не проверены на Windows.",
    "Не проверены накопление сдвига после множества групп и физический MacBook."
  ],
  "reviewers": {
    "manifestSpec": null,
    "craft": null
  },
  "blind": null
}
