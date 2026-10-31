window.STATE =
{
  "slug": "gallery05-moonlight",
  "dir": "2026-11-01-gallery05-moonlight",
  "title": "Лунное освещение галереи",
  "mode": "full",
  "depth": "normal",
  "polish": null,
  "tier": "T0",
  "briefFile": "2026-11-01-brief.md",
  "memoryFile": "AGENTS.md",
  "skillDir": "C:/Users/McHomak/.agents/skills/autopilot",
  "startedAt": "2026-11-01T01:09:45+03:00",
  "updatedAt": "2026-11-01T01:55:18+03:00",
  "finishedAt": "2026-11-01T01:55:18+03:00",
  "stages": [
    {
      "id": "preflight",
      "status": "done",
      "startedAt": "2026-11-01T01:09:45+03:00",
      "finishedAt": "2026-11-01T01:09:45+03:00"
    },
    {
      "id": "manifest",
      "status": "done",
      "startedAt": "2026-11-01T01:10:52+03:00",
      "finishedAt": "2026-11-01T01:10:52+03:00"
    },
    {
      "id": "briefing",
      "status": "skipped",
      "note": "Полный автомат: самобрифинг"
    },
    {
      "id": "spec",
      "status": "done",
      "startedAt": "2026-11-01T01:10:52+03:00",
      "finishedAt": "2026-11-01T01:10:52+03:00"
    },
    {
      "id": "plan",
      "status": "skipped",
      "note": "T0: единое связное изменение"
    },
    {
      "id": "build",
      "status": "done",
      "startedAt": "2026-11-01T01:10:52+03:00",
      "finishedAt": "2026-11-01T01:45:47+03:00"
    },
    {
      "id": "review",
      "status": "done",
      "startedAt": "2026-11-01T01:45:47+03:00",
      "finishedAt": "2026-11-01T01:45:47+03:00"
    },
    {
      "id": "final",
      "status": "done",
      "startedAt": "2026-11-01T01:45:47+03:00",
      "finishedAt": "2026-11-01T01:55:18+03:00"
    }
  ],
  "requirements": {
    "total": 19,
    "done": 19,
    "inTicket": 0,
    "inSpec": 0,
    "placeholder": 0,
    "deferred": 0,
    "dropped": 0
  },
  "tickets": [],
  "singlePass": {
    "status": "done",
    "startedAt": "2026-11-01T01:10:52+03:00",
    "tests": "npm run check: 325 тестов",
    "finishedAt": "2026-11-01T01:55:18+03:00"
  },
  "tests": {
    "status": "passed",
    "summary": "npm run check: 325 тестов, lint, typecheck, production build"
  },
  "debt": {
    "placeholders": [],
    "assumptions": [
      "Использованы существующие слои рассеивания вместо дополнительного полноэкранного прохода; лучи стилизованы и не учитывают заслонение."
    ],
    "emptyEnv": []
  },
  "additions": [],
  "coverage": {
    "found": 2,
    "fixed": 2
  },
  "concerns": [],
  "reviewers": {
    "manifestSpec": null,
    "craft": null
  },
  "blind": {
    "status": "partial",
    "note": "Встроенный браузер без WebGL2; отдельный Chrome показал сцену, без ошибок. Рамки и крайний случай исправлены после замечаний. Облака сохраняют прежние геометрические контуры; iPad не проверен."
  }
}