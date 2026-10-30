window.STATE =
{
  "slug": "prologue-emissive-dissolve",
  "dir": "2026-10-30-prologue-emissive-dissolve--wip",
  "title": "Побуквенное превращение текста Пролога в свет",
  "mode": "full",
  "depth": "normal",
  "polish": null,
  "tier": "T1",
  "briefFile": "2026-10-30-brief.md",
  "memoryFile": "AGENTS.md",
  "skillDir": "C:\\Users\\McHomak\\.agents\\skills\\autopilot",
  "startedAt": "2026-10-30T19:14:17+03:00",
  "updatedAt": "2026-10-30T23:58:46+03:00",
  "finishedAt": null,
  "stages": [
    {
      "id": "preflight",
      "status": "done",
      "startedAt": "2026-10-30T19:14:17+03:00",
      "finishedAt": "2026-10-30T19:31:59+03:00"
    },
    {
      "id": "manifest",
      "status": "done",
      "startedAt": "2026-10-30T19:14:17+03:00",
      "finishedAt": "2026-10-30T19:31:43+03:00"
    },
    {
      "id": "briefing",
      "status": "skipped",
      "startedAt": "2026-10-30T19:31:59+03:00",
      "note": "full mode: self-briefing",
      "finishedAt": "2026-10-30T19:32:50+03:00"
    },
    {
      "id": "spec",
      "status": "done",
      "startedAt": "2026-10-30T19:32:50+03:00",
      "finishedAt": "2026-10-30T20:04:50+03:00"
    },
    {
      "id": "plan",
      "status": "done",
      "startedAt": "2026-10-30T20:04:50+03:00",
      "finishedAt": "2026-10-30T20:09:02+03:00"
    },
    {
      "id": "build",
      "status": "active",
      "startedAt": "2026-10-30T20:09:02+03:00"
    },
    {
      "id": "review",
      "status": "active",
      "startedAt": "2026-10-30T22:15:00+03:00"
    },
    {
      "id": "final",
      "status": "pending"
    }
  ],
  "requirements": {
    "total": 69,
    "done": 28,
    "inTicket": 41,
    "inSpec": 0,
    "placeholder": 0,
    "deferred": 0,
    "dropped": 0
  },
  "tickets": [
    {
      "id": "01",
      "title": "???????????????? ????? ? ???????? ???????????",
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
        "R17",
        "R18",
        "R19",
        "R20",
        "R30",
        "R31",
        "R32",
        "R33",
        "R34",
        "R35",
        "R37",
        "R38",
        "R39",
        "R40",
        "R41",
        "R42",
        "R43",
        "R48",
        "R49",
        "R50",
        "R51",
        "R52",
        "R53",
        "R62",
        "R63",
        "R64",
        "R65",
        "R66",
        "R67",
        "R68"
      ],
      "blockedBy": [],
      "wave": 1,
      "zone": [
        "frontend/src/scenes/prologue/",
        "frontend/src/scenes/shared/dissolve/",
        "frontend/src/assets/typography/",
        "frontend/src/systems/scene-config/"
      ],
      "status": "done",
      "retries": 0,
      "repairs": 0,
      "handoffs": 0,
      "startedAt": "2026-10-30T21:02:19+03:00",
      "finishedAt": "2026-10-30T22:46:12+03:00",
      "tests": {
        "passed": 214,
        "failed": 0
      },
      "concerns": [
        "Runtime shader visual review was not completed because port 5174 was occupied."
      ],
      "commit": "a711a1f"
    },
    {
      "id": "02",
      "title": "??????? ?? ??????? ? ?????? ????????",
      "requirements": [
        "R05",
        "R06",
        "R07",
        "R16",
        "R21",
        "R22",
        "R23",
        "R24",
        "R25",
        "R26",
        "R27",
        "R28",
        "R29",
        "R30",
        "R31",
        "R32",
        "R33",
        "R36",
        "R38",
        "R44",
        "R45",
        "R46",
        "R47",
        "R51",
        "R52",
        "R53",
        "R54",
        "R55",
        "R56",
        "R57",
        "R58",
        "R59",
        "R60",
        "R61",
        "R62",
        "R64",
        "R65",
        "R66",
        "R67",
        "R68",
        "R69"
      ],
      "blockedBy": [
        "01"
      ],
      "wave": 2,
      "zone": [
        "frontend/src/scenes/prologue/",
        "frontend/src/scenes/shared/dissolve/",
        "frontend/src/engine/",
        "frontend/src/systems/scene-config/",
        "frontend/src/components/"
      ],
      "status": "review",
      "retries": 0,
      "repairs": 1,
      "handoffs": 0,
      "startedAt": "2026-10-30T22:46:12+03:00",
      "finishedAt": "2026-10-30T23:57:22+03:00",
      "tests": {
        "passed": 216,
        "failed": 0
      },
      "concerns": [
        "Runtime visual review unavailable because Playwright/Chrome DevTools profiles were occupied."
      ]
    }
  ],
  "singlePass": null,
  "tests": null,
  "debt": {
    "placeholders": [],
    "assumptions": [],
    "emptyEnv": []
  },
  "additions": [],
  "coverage": {
    "findings": 10,
    "reruns": 3,
    "final": "pass",
    "notes": [
      "Уточнено спокойное поведение центральной точки во время фраз и распада.",
      "Удалены не заданные в брифе абсолютные отметки времени; сохранены диапазон 1.35 с, середина волны и заданное время чтения 2.0–2.5 с.",
      "Уточнено исследование текущей сцены и разделение принципов reference source на переносимые и переписываемые.",
      "Зафиксированы запреты на агрессивные вспышки, серую пыль и цифровую крошку.",
      "Сняты новые продуктовые требования для fallback/reduced motion и проверки; существующие проектные процедуры сохраняются вне feature scope.",
      "Убраны внутренние номера требований из пользовательских историй; финальная слепая проверка gaps не нашла."
    ]
  },
  "concerns": [
    {
      "ticket": "01",
      "kind": "visual review",
      "note": "Runtime shader visual review was not completed because port 5174 was occupied; attempt isolated preview on another port before final acceptance."
    },
    {
      "ticket": "01",
      "kind": "spec",
      "note": "frontend/src/scenes/prologue/letterMatter.ts:154 ? particleBirths uses an atlas-wide noise field rather than the per-grapheme dissolve threshold. Ticket 02 must align emission to the shared threshold before using it."
    },
    {
      "ticket": "01",
      "kind": "craft",
      "note": "frontend/src/systems/scene-config/fontCatalog.test.ts:58 ? test does not assert document.fonts.add occurs before load/check."
    },
    {
      "ticket": "01",
      "kind": "craft",
      "note": "frontend/src/scenes/prologue/letterMatter.ts:170 ? Array.from fallback may split combining graphemes when Intl.Segmenter is unavailable."
    },
    {
      "ticket": "01",
      "kind": "visual review",
      "note": "Runtime dissolve screenshot could not be captured: Playwright and Chrome DevTools profiles are in use; isolated page creation also failed. Reviewer server was at 127.0.0.1:5187."
    },
    {
      "ticket": "02",
      "kind": "visual review",
      "note": "Runtime visual review remains unavailable because the shared browser profiles are occupied."
    },
    {
      "ticket": "02",
      "kind": "craft",
      "note": "frontend/src/scenes/prologue/letterMatter.test.ts:16 ? fixture injects particleBirths directly and lacks a halo-only texel, so it does not exercise the raster-to-alpha sampler seam."
    }
  ],
  "reviewers": {
    "manifestSpec": "/root/review_01_manifest_spec",
    "craft": "/root/review_01_craft"
  },
  "blind": null
};
