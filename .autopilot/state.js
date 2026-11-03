window.STATE =
{
  "slug": "gallery-water-clouds",
  "dir": "2026-11-03-gallery-water-clouds--wip",
  "title": "Живая вода и оптимизация облаков",
  "mode": "full",
  "depth": "normal",
  "tier": "T1",
  "polish": null,
  "briefFile": "2026-11-03-brief.md",
  "memoryFile": "AGENTS.md",
  "skillDir": "C:/Users/McHomak/.agents/skills/autopilot",
  "startedAt": "2026-11-03T14:28:26+03:00",
  "updatedAt": "2026-11-03T17:19:50+03:00",
  "finishedAt": null,
  "stages": [
    {
      "id": "preflight",
      "status": "done",
      "startedAt": "2026-11-03T14:28:26+03:00",
      "finishedAt": "2026-11-03T14:28:26+03:00"
    },
    {
      "id": "manifest",
      "status": "done",
      "startedAt": "2026-11-03T14:28:26+03:00",
      "finishedAt": "2026-11-03T14:30:41+03:00"
    },
    {
      "id": "briefing",
      "status": "skipped",
      "note": "полный автомат — самобрифинг"
    },
    {
      "id": "spec",
      "status": "done",
      "startedAt": "2026-11-03T14:30:41+03:00",
      "finishedAt": "2026-11-03T14:30:41+03:00"
    },
    {
      "id": "plan",
      "status": "done",
      "startedAt": "2026-11-03T14:30:41+03:00",
      "finishedAt": "2026-11-03T14:30:41+03:00"
    },
    {
      "id": "build",
      "status": "active",
      "startedAt": "2026-11-03T14:30:41+03:00"
    },
    {
      "id": "review",
      "status": "active",
      "startedAt": "2026-11-03T15:03:54+03:00"
    },
    {
      "id": "final",
      "status": "pending"
    }
  ],
  "requirements": {
    "total": 8,
    "done": 0,
    "inTicket": 8,
    "inSpec": 0,
    "placeholder": 0,
    "deferred": 0,
    "dropped": 0
  },
  "tickets": [
    {
      "id": "01",
      "title": "Живая вода и отражения",
      "requirements": [
        "R01",
        "R02",
        "R03",
        "R04",
        "R05",
        "R08"
      ],
      "blockedBy": [],
      "wave": 1,
      "zone": [
        "water"
      ],
      "status": "review",
      "startedAt": "2026-11-03T14:30:41+03:00",
      "retries": 0,
      "repairs": 2,
      "handoffs": 0,
      "repairFindings": [
        "R04: дорожка должна идти от дальнего горизонта; hotspot не является её началом."
      ]
    },
    {
      "id": "02",
      "title": "Качество и бюджет облаков",
      "requirements": [
        "R05",
        "R06",
        "R07",
        "R08"
      ],
      "blockedBy": [],
      "wave": 1,
      "zone": [
        "clouds"
      ],
      "status": "review",
      "startedAt": "2026-11-03T14:30:41+03:00",
      "retries": 0,
      "repairs": 1,
      "handoffs": 0,
      "repairFindings": [
        "Partial ray segment midpoint must stay inside volume."
      ]
    }
  ],
  "singlePass": null,
  "tests": "npm run check: 92 files, 452 tests passed; lint, typecheck and build passed",
  "debt": {
    "placeholders": [],
    "assumptions": [
      "Сохраняем плоскую воду; усиливаем движение нормалей и деформацию отражений.",
      "Качество облаков распределяем по видимости и близости к экспозиции."
    ],
    "emptyEnv": []
  },
  "additions": [],
  "coverage": {
    "found": 2,
    "fixed": 2,
    "deferred": 0
  },
  "concerns": [
    "Расчётный sample budget снижен, page rAF замер до/после не показал достоверного изменения FPS.",
    "Numeric cloud shader test mirrors GLSL in TypeScript; shader-only regression may pass.",
    "Visual acceptance remains unverified: browser access unavailable; GPU temperature and FPS not measured."
  ],
  "reviewers": {
    "manifestSpec": "/root/water_spec_check",
    "craft": "/root/water_review"
  },
  "blind": null
}
