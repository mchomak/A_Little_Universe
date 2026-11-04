window.STATE =
{
  "slug": "gallery-particle-reveal",
  "dir": "2026-11-04-gallery-particle-reveal",
  "title": "Галерея: проявление коллажей из частиц",
  "mode": "full",
  "depth": "normal",
  "polish": null,
  "tier": "T1",
  "briefFile": "2026-11-04-brief.md",
  "memoryFile": "AGENTS.md",
  "skillDir": "C:/Users/McHomak/.agents/skills/autopilot",
  "startedAt": "2026-11-04T18:47:53+03:00",
  "updatedAt": "2026-11-05T00:33:13+03:00",
  "finishedAt": "2026-11-05T00:33:13+03:00",
  "stages": [
    {
      "id": "preflight",
      "status": "done",
      "startedAt": "2026-11-04T18:47:53+03:00",
      "finishedAt": "2026-11-04T18:49:25+03:00"
    },
    {
      "id": "manifest",
      "status": "done",
      "startedAt": "2026-11-04T18:49:25+03:00",
      "finishedAt": "2026-11-04T19:10:00+03:00"
    },
    {
      "id": "briefing",
      "status": "skipped",
      "note": "полный автомат — самобрифинг",
      "startedAt": "2026-11-04T19:10:00+03:00",
      "finishedAt": "2026-11-04T19:10:00+03:00"
    },
    {
      "id": "spec",
      "status": "done",
      "startedAt": "2026-11-04T19:10:00+03:00",
      "finishedAt": "2026-11-04T19:24:31+03:00"
    },
    {
      "id": "plan",
      "status": "done",
      "startedAt": "2026-11-04T19:24:31+03:00",
      "finishedAt": "2026-11-04T19:27:51+03:00",
      "note": "2 таска, ярус T1"
    },
    {
      "id": "build",
      "status": "done",
      "startedAt": "2026-11-04T19:27:51+03:00",
      "note": "Two tasks and texture-load repair committed",
      "finishedAt": "2026-11-05T00:10:39+03:00"
    },
    {
      "id": "review",
      "status": "done",
      "startedAt": "2026-11-04T19:45:56+03:00",
      "note": "Independent code review complete",
      "finishedAt": "2026-11-05T00:10:39+03:00"
    },
    {
      "id": "final",
      "status": "done",
      "startedAt": "2026-11-05T00:10:39+03:00",
      "finishedAt": "2026-11-05T00:33:13+03:00",
      "note": "Blind acceptance and browser checks"
    }
  ],
  "requirements": {
    "total": 56,
    "done": 56,
    "inTicket": 0,
    "inSpec": 0,
    "placeholder": 0,
    "deferred": 0,
    "dropped": 0
  },
  "tickets": [
    {
      "id": "01",
      "title": "Сборка и проявление дополнительных фото",
      "requirements": [
        "R01",
        "R02",
        "R03",
        "R04",
        "R05",
        "R06",
        "R07",
        "R08",
        "R09",
        "R10",
        "R11",
        "R12",
        "R13",
        "R14",
        "R15",
        "R16",
        "R17",
        "R18",
        "R19",
        "R20",
        "R21",
        "R22",
        "R23",
        "R24",
        "R25",
        "R26",
        "R27",
        "R28",
        "R39",
        "R40",
        "R41",
        "R42",
        "R43",
        "R44",
        "R51",
        "R52",
        "A01"
      ],
      "blockedBy": [],
      "wave": 1,
      "zone": [
        "frontend/src/scenes/gallery/",
        "frontend/src/scenes/shared/",
        "frontend/src/scenes/IdentityScene.tsx"
      ],
      "status": "done",
      "retries": 0,
      "repairs": 2,
      "repairFindings": [
        "R05/R08: loaded extra-photo Texture is bound to the photo material but not the particle material; particles sample fallback instead of the event image.",
        "Full npm run check: React hooks refs/dependencies and unused variable fail lint.",
        "D01: adapt actual Scene 04 spatial photo reveal and verify durations use elapsed seconds."
      ],
      "handoffs": 0,
      "startedAt": "2026-11-04T19:28:31+03:00",
      "tests": {
        "command": "npm run check",
        "passed": 494,
        "failed": 0
      },
      "finishedAt": "2026-11-04T23:38:29+03:00",
      "commit": "dd17aa0"
    },
    {
      "id": "02",
      "title": "Настройки и конфигурация коллажей",
      "requirements": [
        "R29",
        "R30",
        "R31",
        "R32",
        "R33",
        "R34",
        "R35",
        "R36",
        "R37",
        "R38",
        "R45",
        "R46",
        "R47",
        "R48",
        "R49",
        "R50",
        "R53",
        "R54",
        "R55",
        "R56"
      ],
      "blockedBy": [
        "01"
      ],
      "wave": 2,
      "zone": [
        "frontend/src/systems/scene-config/",
        "frontend/src/debug/",
        "frontend/src/scenes/gallery/",
        "frontend/src/scenes/GalleryScene.tsx"
      ],
      "status": "done",
      "retries": 0,
      "repairs": 0,
      "repairFindings": [],
      "handoffs": 0,
      "startedAt": "2026-11-04T23:38:29+03:00",
      "finishedAt": "2026-11-05T00:10:39+03:00",
      "commit": "7da054c",
      "tests": {
        "command": "npm run check",
        "passed": 500,
        "failed": 0
      }
    }
  ],
  "singlePass": null,
  "tests": {
    "command": "npm run check",
    "passed": 504,
    "failed": 0
  },
  "debt": {
    "placeholders": [],
    "assumptions": [
      "Сэмплирование цвета частиц из уже загруженной Three.js texture без дополнительного canvas.",
      "Разворот timeline на unfocus; assembly 0.72 с, reveal 0.68 с, stagger 0.14 с.",
      "Коллажи с одним дополнительным фото используют тот же визуальный режим.",
      "Настройки per-collage keyed стабильным event id.",
      "В DEV-группе доступны count, size, noise, depth, glow, assembly, reveal и stagger.",
      "The current Scene 04 spatial reveal was adapted from the adjacent branch; no scene files were imported."
    ],
    "emptyEnv": []
  },
  "additions": [
    "A01: единая particle-анимация также работает для события с одним дополнительным фото (родитель R01)."
  ],
  "coverage": {
    "status": "passed",
    "missing": 0,
    "partialFindings": 4,
    "partialResolved": 4,
    "addedCapability": "A01 -> R01",
    "reviewer": "independent brief/spec comparison",
    "summary": "All four partial findings were fixed; no remaining missing or partial coverage."
  },
  "concerns": [
    "T01 collage.test.ts: UV-to-target per-particle correspondence is not asserted; non-blocking, triage at final acceptance.",
    "Component tests do not independently exercise visibility and stale-load guards; browser delayed-load check and code review supplement pure timeline tests."
  ],
  "reviewers": {
    "manifestSpec": "/root/ticket_01_manifest_review",
    "craft": "/root/ticket_01_craft_review"
  },
  "blind": {
    "status": "resolved",
    "summary": "Slow-photo texture race found and fixed in f22e7b4; separate isolated browser verified focus cycles, resources and layout. Independent blind browser lacked WebGL2."
  }
}
