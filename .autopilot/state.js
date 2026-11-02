window.STATE =
{
  "slug": "gallery-cloud-layers",
  "dir": "2026-11-02-gallery-cloud-layers",
  "title": "Scene 05: cloud layers",
  "mode": "full",
  "depth": "normal",
  "tier": "T0",
  "briefFile": "2026-11-02-brief.md",
  "memoryFile": "AGENTS.md",
  "skillDir": "C:/Users/McHomak/.agents/skills/autopilot",
  "startedAt": "2026-11-02T15:56:05+03:00",
  "updatedAt": "2026-11-02T20:27:37+03:00",
  "finishedAt": "2026-11-02T20:27:37+03:00",
  "stages": [
    {
      "id": "preflight",
      "status": "done",
      "startedAt": "2026-11-02T15:56:05+03:00",
      "finishedAt": "2026-11-02T15:56:05+03:00"
    },
    {
      "id": "manifest",
      "status": "done",
      "startedAt": "2026-11-02T15:56:05+03:00",
      "finishedAt": "2026-11-02T15:56:05+03:00"
    },
    {
      "id": "briefing",
      "status": "skipped",
      "note": "full self-briefing"
    },
    {
      "id": "spec",
      "status": "done",
      "startedAt": "2026-11-02T15:56:05+03:00",
      "finishedAt": "2026-11-02T15:56:05+03:00"
    },
    {
      "id": "plan",
      "status": "skipped",
      "note": "single pass"
    },
    {
      "id": "build",
      "status": "done",
      "startedAt": "2026-11-02T15:56:05+03:00",
      "note": "Cloud layers and controls in progress",
      "finishedAt": "2026-11-02T20:27:37+03:00"
    },
    {
      "id": "review",
      "status": "done",
      "finishedAt": "2026-11-02T20:27:37+03:00"
    },
    {
      "id": "final",
      "status": "done",
      "finishedAt": "2026-11-02T20:27:37+03:00",
      "note": "Визуальная проверка выполнена; фактура низких облаков остаётся мягче референса."
    }
  ],
  "requirements": {
    "total": 12,
    "done": 10,
    "inTicket": 0,
    "inSpec": 0,
    "placeholder": 0,
    "deferred": 0,
    "dropped": 0,
    "partial": 2
  },
  "tickets": [],
  "singlePass": {
    "startedAt": "2026-11-02T15:56:05+03:00",
    "finishedAt": "2026-11-02T20:27:37+03:00"
  },
  "tests": {
    "command": "npm run check",
    "status": "passed",
    "detail": "91 файлов, 434 теста; lint, typecheck и production build прошли"
  },
  "debt": {
    "placeholders": [],
    "assumptions": [],
    "emptyEnv": []
  },
  "additions": [],
  "coverage": {
    "found": 6,
    "fixed": 6,
    "deferred": 0
  },
  "concerns": [
    {
      "title": "Художественное совпадение",
      "note": "Низкие облака мягче утверждённого референса; нужна оценка на целевом дисплее."
    },
    {
      "title": "Целевое устройство",
      "note": "FPS и цвет на физическом MacBook M2 не измерялись."
    }
  ],
  "reviewers": {
    "manifestSpec": null,
    "craft": null
  },
  "blind": {
    "status": "findings",
    "note": "Первичная независимая приёмка выявила слабые низкие облака и незаметное перекрытие луны. После ремонта выполнен повторный просмотр координатором: низкие массы и пересечение диска видны, но фактура остаётся мягче референса; физический MacBook M2 не проверен."
  },
  "polish": null
}
