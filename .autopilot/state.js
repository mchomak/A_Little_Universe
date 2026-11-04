window.STATE =
{
  "slug": "gallery-clouds",
  "dir": "2026-11-04-gallery-clouds",
  "title": "Галерея: облака и настройки",
  "mode": "full",
  "depth": "normal",
  "polish": null,
  "tier": "T1",
  "briefFile": "2026-11-04-brief.md",
  "memoryFile": "AGENTS.md",
  "skillDir": "C:/Users/McHomak/.agents/skills/autopilot",
  "startedAt": "2026-11-04T02:15:32+03:00",
  "updatedAt": "2026-11-04T03:39:53+03:00",
  "finishedAt": "2026-11-04T03:39:53+03:00",
  "stages": [
    {
      "id": "preflight",
      "status": "done",
      "startedAt": "2026-11-04T02:15:32+03:00",
      "finishedAt": "2026-11-04T03:34:25+03:00"
    },
    {
      "id": "manifest",
      "status": "done",
      "startedAt": "2026-11-04T02:15:32+03:00",
      "finishedAt": "2026-11-04T03:34:25+03:00"
    },
    {
      "id": "briefing",
      "status": "done",
      "startedAt": "2026-11-04T02:15:32+03:00",
      "finishedAt": "2026-11-04T03:34:25+03:00"
    },
    {
      "id": "spec",
      "status": "done",
      "startedAt": "2026-11-04T02:15:32+03:00",
      "finishedAt": "2026-11-04T03:34:25+03:00"
    },
    {
      "id": "plan",
      "status": "done",
      "startedAt": "2026-11-04T02:15:32+03:00",
      "finishedAt": "2026-11-04T03:34:25+03:00"
    },
    {
      "id": "build",
      "status": "done",
      "startedAt": "2026-11-04T02:15:32+03:00",
      "finishedAt": "2026-11-04T03:34:25+03:00"
    },
    {
      "id": "review",
      "status": "done",
      "startedAt": "2026-11-04T02:15:32+03:00",
      "finishedAt": "2026-11-04T03:34:25+03:00"
    },
    {
      "id": "final",
      "status": "done",
      "startedAt": "2026-11-04T03:34:25+03:00",
      "finishedAt": "2026-11-04T03:39:53+03:00"
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
      "title": "Галерея: настройки и облака",
      "requirements": [
        "R01",
        "R02",
        "R03",
        "R04",
        "R05",
        "R06",
        "R07",
        "R08",
        "R09"
      ],
      "blockedBy": [],
      "wave": 1,
      "zone": [
        "frontend/src/"
      ],
      "status": "done",
      "startedAt": "2026-11-04T02:15:32+03:00",
      "retries": 0,
      "repairs": 0,
      "handoffs": 0,
      "finishedAt": "2026-11-04T03:39:53+03:00"
    }
  ],
  "singlePass": null,
  "tests": {
    "passed": 478,
    "failed": 0
  },
  "debt": {
    "placeholders": [],
    "assumptions": [],
    "emptyEnv": []
  },
  "additions": [],
  "coverage": {
    "found": 0,
    "fixed": 0,
    "detail": "независимая сверка брифа и спецификации"
  },
  "concerns": [
    "WebGL2 недоступен во встроенном браузере; визуальная проверка линии горизонта и лунного диска не выполнена."
  ],
  "reviewers": {
    "manifestSpec": null,
    "craft": null
  },
  "blind": "Покрыто кодом и тестами; визуальная проверка шва и Луны недоступна без WebGL2."
}
