window.STATE =
{
  "slug": "scene-04-freeze",
  "dir": "2026-11-03-scene-04-freeze",
  "title": "Устранение зависания сцены 04",
  "mode": "full",
  "depth": "normal",
  "polish": null,
  "tier": "T0",
  "briefFile": "2026-11-03-brief.md",
  "memoryFile": "AGENTS.md",
  "skillDir": "C:/Users/McHomak/.agents/skills/autopilot",
  "startedAt": "2026-11-03T16:18:31+03:00",
  "updatedAt": "2026-11-03T17:10:56+03:00",
  "finishedAt": "2026-11-03T17:10:56+03:00",
  "stages": [
    {
      "id": "preflight",
      "status": "done",
      "startedAt": "2026-11-03T16:18:31+03:00",
      "finishedAt": "2026-11-03T17:10:56+03:00"
    },
    {
      "id": "manifest",
      "status": "done",
      "startedAt": "2026-11-03T16:18:31+03:00",
      "finishedAt": "2026-11-03T17:10:56+03:00"
    },
    {
      "id": "briefing",
      "status": "skipped",
      "startedAt": "2026-11-03T16:18:31+03:00",
      "note": "полный автомат — самобрифинг"
    },
    {
      "id": "spec",
      "status": "done",
      "startedAt": "2026-11-03T16:18:31+03:00",
      "finishedAt": "2026-11-03T17:10:56+03:00"
    },
    {
      "id": "plan",
      "status": "skipped",
      "startedAt": "2026-11-03T16:18:31+03:00",
      "note": "T0 — один проход без тасков"
    },
    {
      "id": "build",
      "status": "done",
      "startedAt": "2026-11-03T16:24:31+03:00",
      "finishedAt": "2026-11-03T17:10:56+03:00"
    },
    {
      "id": "review",
      "status": "done",
      "startedAt": "2026-11-03T16:18:31+03:00",
      "finishedAt": "2026-11-03T17:10:56+03:00"
    },
    {
      "id": "final",
      "status": "done",
      "startedAt": "2026-11-03T16:18:31+03:00",
      "finishedAt": "2026-11-03T17:10:56+03:00"
    }
  ],
  "requirements": {
    "total": 2,
    "done": 2,
    "inTicket": 0,
    "inSpec": 0,
    "placeholder": 0,
    "deferred": 0,
    "dropped": 0
  },
  "tickets": [],
  "singlePass": {
    "startedAt": "2026-11-03T16:24:31+03:00",
    "finishedAt": "2026-11-03T17:10:56+03:00"
  },
  "tests": {
    "status": "passed",
    "command": "npm run check",
    "detail": "563 теста, lint, typecheck и build"
  },
  "debt": {
    "placeholders": [],
    "assumptions": [],
    "emptyEnv": []
  },
  "additions": [],
  "coverage": {
    "status": "passed",
    "detail": "независимая проверка брифа и спецификации"
  },
  "concerns": [
    "Worker занял 17.02 секунды на тестовой машине; длительное ожидание отмечается статусом. DEV-ползунки могут перезапускать подготовку."
  ],
  "reviewers": {
    "manifestSpec": null,
    "craft": null
  },
  "blind": {
    "status": "passed",
    "detail": "независимое ревью; браузерное измерение продолжения таймлайна"
  }
}
