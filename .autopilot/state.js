window.STATE =
{
  "slug": "gallery-arch",
  "dir": "2026-11-03-gallery-arch",
  "title": "Галерея: плавное появление и арка",
  "mode": "full",
  "depth": "normal",
  "polish": null,
  "tier": "T0",
  "briefFile": "2026-11-03-brief.md",
  "memoryFile": "AGENTS.md",
  "skillDir": "C:/Users/McHomak/.agents/skills/autopilot",
  "startedAt": "2026-11-03T12:35:50+03:00",
  "updatedAt": "2026-11-03T14:16:57+03:00",
  "finishedAt": "2026-11-03T14:16:57+03:00",
  "stages": [
    {
      "id": "preflight",
      "status": "done",
      "startedAt": "2026-11-03T12:35:50+03:00",
      "finishedAt": "2026-11-03T12:35:50+03:00"
    },
    {
      "id": "manifest",
      "status": "done",
      "startedAt": "2026-11-03T12:35:50+03:00",
      "finishedAt": "2026-11-03T12:35:50+03:00"
    },
    {
      "id": "briefing",
      "status": "skipped",
      "note": "полный автомат — самобрифинг"
    },
    {
      "id": "spec",
      "status": "done",
      "startedAt": "2026-11-03T12:35:50+03:00",
      "finishedAt": "2026-11-03T12:35:50+03:00"
    },
    {
      "id": "plan",
      "status": "skipped",
      "note": "T0 — один проход"
    },
    {
      "id": "build",
      "status": "done",
      "startedAt": "2026-11-03T12:35:50+03:00",
      "finishedAt": "2026-11-03T14:16:57+03:00"
    },
    {
      "id": "review",
      "status": "done",
      "finishedAt": "2026-11-03T14:16:57+03:00",
      "startedAt": "2026-11-03T14:16:57+03:00"
    },
    {
      "id": "final",
      "status": "done",
      "finishedAt": "2026-11-03T14:16:57+03:00",
      "startedAt": "2026-11-03T14:16:57+03:00"
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
  "tickets": [],
  "singlePass": {
    "startedAt": "2026-11-03T12:35:50+03:00",
    "finishedAt": "2026-11-03T14:16:57+03:00"
  },
  "tests": {
    "command": "npm run check",
    "status": "passed",
    "detail": "92 файлов, 447 тестов; lint, typecheck и production build прошли"
  },
  "debt": {
    "placeholders": [],
    "assumptions": [],
    "emptyEnv": []
  },
  "additions": [],
  "coverage": {
    "findings": 2,
    "resolved": 2
  },
  "concerns": [
    "Композиция проверена на Windows Chrome, на MacBook M2 не проверялась."
  ],
  "reviewers": {
    "manifestSpec": null,
    "craft": null
  },
  "blind": {
    "result": "Встроенный браузер без WebGL2; координатор проверил Chrome: арка и луна видны в проёме, дальние объекты полупрозрачны."
  }
}
