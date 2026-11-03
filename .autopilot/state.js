window.STATE =
{
  "slug": "gallery-layout-ab",
  "dir": "2026-11-03-gallery-layout-ab",
  "title": "A/B размещения картин в галерее",
  "mode": "full",
  "depth": "normal",
  "polish": null,
  "tier": "T1",
  "briefFile": "2026-11-03-brief.md",
  "memoryFile": "AGENTS.md",
  "skillDir": "C:/Users/McHomak/.agents/skills/autopilot",
  "startedAt": "2026-11-03T19:44:29+03:00",
  "updatedAt": "2026-11-03T20:27:45+03:00",
  "finishedAt": "2026-11-03T20:27:45+03:00",
  "stages": [
    {
      "id": "preflight",
      "status": "done",
      "startedAt": "2026-11-03T19:44:29+03:00",
      "finishedAt": "2026-11-03T19:44:29+03:00"
    },
    {
      "id": "manifest",
      "status": "done",
      "startedAt": "2026-11-03T19:44:29+03:00",
      "finishedAt": "2026-11-03T19:47:08+03:00"
    },
    {
      "id": "briefing",
      "status": "skipped",
      "note": "полный автомат — самобрифинг"
    },
    {
      "id": "spec",
      "status": "done",
      "finishedAt": "2026-11-03T19:47:08+03:00"
    },
    {
      "id": "plan",
      "status": "done",
      "finishedAt": "2026-11-03T19:47:08+03:00"
    },
    {
      "id": "build",
      "status": "done",
      "startedAt": "2026-11-03T19:47:08+03:00",
      "finishedAt": "2026-11-03T20:27:45+03:00"
    },
    {
      "id": "review",
      "status": "done",
      "finishedAt": "2026-11-03T20:27:45+03:00",
      "startedAt": "2026-11-03T20:27:45+03:00"
    },
    {
      "id": "final",
      "status": "done",
      "finishedAt": "2026-11-03T20:27:45+03:00",
      "startedAt": "2026-11-03T20:27:45+03:00"
    }
  ],
  "requirements": {
    "total": 4,
    "done": 4,
    "inTicket": 0,
    "inSpec": 0,
    "placeholder": 0,
    "deferred": 0,
    "dropped": 0
  },
  "tickets": [
    {
      "id": "01",
      "title": "Компоновка и сохранение",
      "requirements": [
        "R01",
        "R02",
        "R04"
      ],
      "blockedBy": [],
      "wave": 1,
      "zone": [
        "scene",
        "config"
      ],
      "status": "done",
      "startedAt": "2026-11-03T19:47:08+03:00",
      "retries": 0,
      "repairs": 0,
      "handoffs": 0,
      "finishedAt": "2026-11-03T19:57:35+03:00",
      "commit": "e62719c",
      "tests": "464 tests; check passed"
    },
    {
      "id": "02",
      "title": "Переключение и настройка",
      "requirements": [
        "R01",
        "R03",
        "R04"
      ],
      "blockedBy": [
        "01"
      ],
      "wave": 2,
      "zone": [
        "dev"
      ],
      "status": "done",
      "retries": 0,
      "repairs": 0,
      "handoffs": 0,
      "startedAt": "2026-11-03T19:57:35+03:00",
      "finishedAt": "2026-11-03T20:27:45+03:00",
      "commit": "7272a56",
      "tests": "465 tests; check passed"
    }
  ],
  "singlePass": null,
  "tests": "npm run check: 94 files, 465 tests; lint, typecheck, build passed",
  "debt": {
    "placeholders": [],
    "assumptions": [
      "A — исходное расположение, B — поперечные пары между колоннами; ширина и смещения каждой компоновки независимы, колонны общие."
    ],
    "emptyEnv": []
  },
  "additions": [],
  "coverage": {
    "status": "passed",
    "detail": "Уточнено поперечное спаривание между сторонами."
  },
  "concerns": [],
  "reviewers": {
    "manifestSpec": null,
    "craft": null
  },
  "blind": "Chrome WebGL2: A/B switch and independent settings verified; focus visible. Overall B view inspected by coordinator; import/export covered by tests, not manually checked."
}
