window.STATE =
{
  "slug": "gallery05-moonlit",
  "dir": "2026-10-31-gallery05-moonlit--wip",
  "title": "Лунная галерея воспоминаний",
  "mode": "full",
  "depth": "normal",
  "polish": null,
  "tier": "T1",
  "briefFile": "2026-10-31-brief.md",
  "memoryFile": "AGENTS.md",
  "skillDir": "C:/Users/McHomak/.agents/skills/autopilot",
  "startedAt": "2026-10-31T03:35:46+03:00",
  "updatedAt": "2026-10-31T04:02:53+03:00",
  "finishedAt": null,
  "stages": [
    {
      "id": "preflight",
      "status": "done",
      "finishedAt": "2026-10-31T03:35:46+03:00",
      "startedAt": "2026-10-31T03:35:46+03:00"
    },
    {
      "id": "manifest",
      "status": "done",
      "startedAt": "2026-10-31T03:35:46+03:00",
      "finishedAt": "2026-10-31T03:38:27+03:00"
    },
    {
      "status": "skipped",
      "id": "briefing",
      "note": "полный автомат — самобрифинг; факты и контент сохраняются из кода, файлы сопоставлены по содержимому"
    },
    {
      "status": "done",
      "id": "spec",
      "startedAt": "2026-10-31T03:38:27+03:00",
      "finishedAt": "2026-10-31T03:44:36+03:00"
    },
    {
      "status": "done",
      "id": "plan",
      "finishedAt": "2026-10-31T03:44:36+03:00",
      "startedAt": "2026-10-31T03:44:36+03:00"
    },
    {
      "status": "active",
      "id": "build",
      "startedAt": "2026-10-31T03:44:36+03:00"
    },
    {
      "status": "active",
      "id": "review",
      "startedAt": "2026-10-31T04:02:53+03:00",
      "note": "Раннее чтение стабильных config/debug/camera changes; окружение ещё на художественной настройке"
    },
    {
      "status": "pending",
      "id": "final"
    }
  ],
  "requirements": {
    "deferred": 0,
    "inSpec": 0,
    "inTicket": 76,
    "placeholder": 0,
    "dropped": 0,
    "done": 0,
    "total": 76
  },
  "tickets": [
    {
      "repairs": 0,
      "retries": 0,
      "title": "Лунное пространство и настройки",
      "zone": [
        "gallery environment",
        "scene config",
        "Inspector"
      ],
      "handoffs": 0,
      "requirements": [
        "R01–R27",
        "R46",
        "R49",
        "R54",
        "R56–R65",
        "R68–R69"
      ],
      "blockedBy": [],
      "status": "in-progress",
      "startedAt": "2026-10-31T03:44:36+03:00",
      "wave": 1,
      "id": "01"
    },
    {
      "repairs": 0,
      "retries": 0,
      "title": "Тёплые воспоминания, отражения и проверка",
      "zone": [
        "new gallery reflection/thread helpers",
        "frameParticles"
      ],
      "handoffs": 0,
      "requirements": [
        "R03–R05",
        "R19–R22",
        "R25–R76"
      ],
      "blockedBy": [],
      "status": "in-progress",
      "wave": 1,
      "id": "02",
      "startedAt": "2026-10-31T04:02:22+03:00",
      "note": "Параллельная подготовка независимых новых reflection/thread modules; GalleryScene integration ждёт commit01. Общих записей нет."
    }
  ],
  "singlePass": null,
  "tests": null,
  "debt": {
    "emptyEnv": [],
    "placeholders": [],
    "assumptions": [
      "Референсы сопоставлены по содержимому; текущие фото и подписи сохраняются."
    ]
  },
  "additions": [],
  "coverage": {
    "deferred": 0,
    "found": 2,
    "fixed": 2,
    "note": "K05-02 стороны и K05-04 композиция закреплены в spec §11; operational checks и docs следуют AGENTS.md."
  },
  "concerns": [],
  "reviewers": {
    "craft": "/root/craft_review",
    "manifestSpec": null
  },
  "blind": null,
  "worktree": "C:/Users/McHomak/.codex/worktrees/gallery05-moonlit/A_Little_Universe",
  "branch": "codex/gallery05-moonlit",
  "base": "07c10ae274dbd866721d0645d3a26408a01f43ba"
}