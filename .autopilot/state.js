window.STATE =
{
  "slug": "scene02-lighting",
  "dir": "2026-11-04-scene02-lighting--wip",
  "title": "Сцена 02 — лунный свет и ночное небо",
  "mode": "full",
  "depth": "normal",
  "polish": null,
  "tier": "T1",
  "briefFile": "2026-11-04-brief.md",
  "memoryFile": "AGENTS.md",
  "skillDir": "C:/Users/McHomak/.agents/skills/autopilot",
  "startedAt": "2026-11-04T02:37:38+03:00",
  "updatedAt": "2026-11-04T11:54:33+03:00",
  "finishedAt": null,
  "stages": [
    {
      "id": "preflight",
      "status": "done",
      "startedAt": "2026-11-04T02:37:38+03:00",
      "finishedAt": "2026-11-04T02:40:32+03:00"
    },
    {
      "id": "manifest",
      "status": "done",
      "finishedAt": "2026-11-04T02:40:32+03:00"
    },
    {
      "id": "briefing",
      "status": "skipped",
      "note": "полный автомат — самобрифинг"
    },
    {
      "id": "spec",
      "status": "done",
      "startedAt": "2026-11-04T02:40:32+03:00",
      "finishedAt": "2026-11-04T02:43:21+03:00"
    },
    {
      "id": "plan",
      "status": "done",
      "finishedAt": "2026-11-04T02:43:21+03:00"
    },
    {
      "id": "build",
      "status": "active",
      "startedAt": "2026-11-04T02:43:21+03:00"
    },
    {
      "id": "review",
      "status": "pending"
    },
    {
      "id": "final",
      "status": "pending"
    }
  ],
  "requirements": {
    "total": 42,
    "done": 0,
    "inTicket": 42,
    "inSpec": 0,
    "placeholder": 0,
    "deferred": 0,
    "dropped": 0
  },
  "tickets": [
    {
      "id": "01",
      "title": "Лунный свет",
      "requirements": [
        "R01–R08",
        "R18–R19",
        "R23–R27",
        "R30–R35",
        "R38"
      ],
      "blockedBy": [],
      "wave": 1,
      "zone": [
        "scene02 lighting"
      ],
      "status": "repair",
      "startedAt": "2026-11-04T02:43:21+03:00",
      "retries": 0,
      "repairs": 1,
      "handoffs": 0
    },
    {
      "id": "02",
      "title": "Ночное небо и облака",
      "requirements": [
        "R09–R17",
        "R20–R24",
        "R27–R42"
      ],
      "blockedBy": [],
      "wave": 1,
      "zone": [
        "scene02 atmosphere"
      ],
      "status": "repair",
      "startedAt": "2026-11-04T02:43:21+03:00",
      "retries": 0,
      "repairs": 1,
      "handoffs": 0
    }
  ],
  "singlePass": null,
  "tests": "npm run check: 559 тестов, lint, typecheck, build — до последней визуальной доработки",
  "debt": {
    "placeholders": [],
    "assumptions": [],
    "emptyEnv": []
  },
  "additions": [],
  "coverage": {
    "found": 12,
    "fixed": 12,
    "deferred": 0,
    "findings": [
      "Независимая проверка: уточнены свет, облака, ограничения и проверка сцены; сохранённые локальные пресеты подтверждены аудитом worktree."
    ]
  },
  "concerns": [],
  "reviewers": {
    "manifestSpec": null,
    "craft": null
  },
  "blind": null
}
