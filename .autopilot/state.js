window.STATE =
{
  "slug": "gallery05-moonlit",
  "dir": "2026-10-31-gallery05-moonlit",
  "title": "Лунная галерея воспоминаний",
  "mode": "full",
  "depth": "normal",
  "polish": null,
  "tier": "T1",
  "briefFile": "2026-10-31-brief.md",
  "memoryFile": "AGENTS.md",
  "skillDir": "C:/Users/McHomak/.agents/skills/autopilot",
  "startedAt": "2026-10-31T03:35:46+03:00",
  "updatedAt": "2026-10-31T14:06:16+03:00",
  "finishedAt": "2026-10-31T14:06:16+03:00",
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
      "status": "done",
      "id": "build",
      "startedAt": "2026-10-31T03:44:36+03:00",
      "note": "Окружение01 принято и закоммичено;02 подключает визуальные системы воспоминаний",
      "finishedAt": "2026-10-31T14:06:16+03:00"
    },
    {
      "status": "done",
      "id": "review",
      "startedAt": "2026-10-31T04:02:53+03:00",
      "note": "Раннее чтение стабильных config/debug/camera changes; окружение ещё на художественной настройке",
      "finishedAt": "2026-10-31T14:06:16+03:00"
    },
    {
      "status": "done",
      "id": "final",
      "startedAt": "2026-10-31T14:06:16+03:00",
      "finishedAt": "2026-10-31T14:06:16+03:00"
    }
  ],
  "requirements": {
    "deferred": 0,
    "inSpec": 0,
    "inTicket": 0,
    "placeholder": 0,
    "dropped": 0,
    "done": 76,
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
      "status": "done",
      "startedAt": "2026-10-31T03:44:36+03:00",
      "wave": 1,
      "id": "01",
      "finishedAt": "2026-10-31T04:24:00+03:00",
      "commit": "327c466",
      "tests": {
        "note": "Fullcheck includes unintegrated02 helper tests",
        "passed": 305,
        "failed": 0
      }
    },
    {
      "repairs": 1,
      "retries": 0,
      "title": "Тёплые воспоминания, отражения и проверка",
      "zone": [
        "GalleryScene",
        "reflection/thread helpers",
        "frameParticles",
        "docs/references"
      ],
      "handoffs": 0,
      "requirements": [
        "R03–R05",
        "R19–R22",
        "R25–R76"
      ],
      "blockedBy": [],
      "status": "done",
      "wave": 1,
      "id": "02",
      "startedAt": "2026-10-31T04:02:22+03:00",
      "note": "Fullcheck308green; cold actualcaptureerrors0; visualcomparison andtouchcheckpending",
      "repairFindings": [
        "Horizontal reflection transforms; childvisibility incorrectlyfalse; thread path crossedcamera walklane; allfixed/tested andCraftclean"
      ],
      "finishedAt": "2026-10-31T14:06:16+03:00",
      "tests": {
        "passed": 315,
        "failed": 0
      }
    },
    {
      "handoffs": 0,
      "status": "done",
      "zone": [
        "world cloud modules",
        "generated cloud atlas"
      ],
      "title": "Облачные планы по референсам",
      "requirements": [
        "R06–R18",
        "R49",
        "R56–R57",
        "R61",
        "R68–R69",
        "D01"
      ],
      "wave": 2,
      "startedAt": "2026-10-31T13:32:49+03:00",
      "id": "03",
      "retries": 0,
      "repairs": 0,
      "blockedBy": [
        "01"
      ],
      "finishedAt": "2026-10-31T14:06:16+03:00",
      "tests": {
        "passed": 315,
        "failed": 0
      }
    }
  ],
  "singlePass": null,
  "tests": {
    "passed": 315,
    "failed": 0
  },
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
  "concerns": [
    "Тесты CPU-маски проверяют четыре края; GPU shader проверяется на вызов маски и визуально, не отдельным pixel-тестом."
  ],
  "reviewers": {
    "craft": "/root/craft_review",
    "manifestSpec": "/root/spec_coverage"
  },
  "blind": {
    "note": "Мировая сцена, настройки и механики подтверждены; визуально проверено координатором в desktop Chrome. Физический iPad/Safari не проверен. Луна объясняет холодный свет через отдельный rig, без физического источника на диске.",
    "status": "reviewed"
  },
  "worktree": "C:/Users/McHomak/.codex/worktrees/gallery05-moonlit/A_Little_Universe",
  "branch": "codex/gallery05-moonlit",
  "base": "07c10ae274dbd866721d0645d3a26408a01f43ba"
}