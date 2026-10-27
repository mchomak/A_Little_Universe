window.STATE =
{
  "slug": "opening-scenes-v2",
  "dir": "2026-10-27-opening-scenes-v2--wip",
  "title": "Сцены 00, 00.1 и 01 — художественная версия 2.0",
  "mode": "full",
  "depth": "normal",
  "polish": null,
  "tier": "T2",
  "briefFile": "2026-10-27-brief.md",
  "memoryFile": "AGENTS.md",
  "skillDir": "C:/Users/McHomak/.agents/skills/autopilot",
  "startedAt": "2026-10-27T17:46:48+03:00",
  "updatedAt": "2026-10-27T19:25:36+03:00",
  "finishedAt": null,
  "stages": [
    {
      "id": "preflight",
      "status": "done",
      "startedAt": "2026-10-27T17:46:48+03:00",
      "finishedAt": "2026-10-27T17:48:55+03:00"
    },
    {
      "id": "manifest",
      "status": "done",
      "startedAt": "2026-10-27T17:48:55+03:00",
      "finishedAt": "2026-10-27T17:51:50+03:00"
    },
    {
      "id": "briefing",
      "status": "skipped",
      "note": "полный автомат — самобрифинг, вопросов не потребовалось"
    },
    {
      "id": "spec",
      "status": "done",
      "startedAt": "2026-10-27T17:51:50+03:00",
      "finishedAt": "2026-10-27T18:23:46+03:00"
    },
    {
      "id": "plan",
      "status": "done",
      "startedAt": "2026-10-27T18:23:46+03:00",
      "finishedAt": "2026-10-27T18:33:31+03:00",
      "note": "5 тасков, ярус T2, 4 волны"
    },
    {
      "id": "build",
      "status": "active",
      "startedAt": "2026-10-27T18:33:31+03:00",
      "note": "3 из 5 тасков готовы; таск 04 разблокирован"
    },
    {
      "id": "review",
      "status": "active",
      "startedAt": "2026-10-27T18:53:25+03:00",
      "note": "3 из 5 тасков готовы; таск 04 разблокирован"
    },
    {
      "id": "final",
      "status": "pending"
    }
  ],
  "requirements": {
    "total": 164,
    "done": 102,
    "inTicket": 62,
    "inSpec": 0,
    "placeholder": 0,
    "deferred": 0,
    "dropped": 0
  },
  "tickets": [
    {
      "id": "01",
      "title": "Конфигурация сцен и локальная типографика",
      "requirements": [
        "R12",
        "R13",
        "R14",
        "R15",
        "R16",
        "R18",
        "R19",
        "R20",
        "R21",
        "R22",
        "R24",
        "R25",
        "R26",
        "R27",
        "R28",
        "R99",
        "R100",
        "R101",
        "R102",
        "R110",
        "R139",
        "R148",
        "R155",
        "R156"
      ],
      "blockedBy": [],
      "wave": 1,
      "zone": [
        "frontend/src/systems/scene-config/",
        "frontend/src/systems/assets/",
        "frontend/src/assets/typography/",
        "frontend/src/styles/fonts.css",
        "frontend/public/",
        "frontend/vite.config.ts"
      ],
      "status": "done",
      "retries": 0,
      "repairs": 1,
      "repairFindings": [
        "npm run check typecheck errors in config.ts/config.test.ts and fontCatalog.test.ts Node module type; full suite 51 tests pass but build fails."
      ],
      "handoffs": 1,
      "concerns": [],
      "startedAt": "2026-10-27T18:34:54+03:00",
      "tests": {
        "passed": 51,
        "failed": 0
      },
      "finishedAt": "2026-10-27T18:59:00+03:00",
      "commit": "e21d81e"
    },
    {
      "id": "02",
      "title": "Scene Composer в DEV-панели",
      "requirements": [
        "R02",
        "R16",
        "R17",
        "R23",
        "R83",
        "R84",
        "R85",
        "R86",
        "R87",
        "R88",
        "R89",
        "R90",
        "R91",
        "R92",
        "R93",
        "R94",
        "R95",
        "R96",
        "R97",
        "R98",
        "R99",
        "R100",
        "R101",
        "R102",
        "R103",
        "R104",
        "R105",
        "R106",
        "R107",
        "R108",
        "R139",
        "R149",
        "R154",
        "R155"
      ],
      "blockedBy": [
        "01"
      ],
      "wave": 2,
      "zone": [
        "frontend/src/debug/",
        "frontend/src/engine/FilmCanvas.tsx"
      ],
      "status": "done",
      "retries": 0,
      "repairs": 1,
      "repairFindings": [
        "Manifest+Spec review blocking: font readiness may keep prior config active while reset/import UI announces success; report that the change was not applied."
      ],
      "handoffs": 1,
      "concerns": [],
      "startedAt": "2026-10-27T18:59:00+03:00",
      "lastHandoff": ".autopilot/2026-10-27-opening-scenes-v2--wip/handoff-02-1.md",
      "tests": {
        "passed": 65,
        "failed": 0
      },
      "finishedAt": "2026-10-27T19:24:00+03:00",
      "review": "Manifest+Spec repair re-review clean; Craft repair re-review clean",
      "commit": "cda1d4a"
    },
    {
      "id": "03",
      "title": "Загрузка, подготовка и единая световая точка",
      "requirements": [
        "R01",
        "R04",
        "R12",
        "R13",
        "R14",
        "R15",
        "R16",
        "R17",
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
        "R39",
        "R40",
        "R41",
        "R42",
        "R43",
        "R44",
        "R45",
        "R46",
        "R47",
        "R48",
        "R49",
        "R50",
        "R51",
        "R52",
        "R53",
        "R89",
        "R90",
        "R109",
        "R113",
        "R114",
        "R145",
        "R146",
        "R147",
        "R150",
        "R157",
        "R158"
      ],
      "blockedBy": [
        "01"
      ],
      "wave": 2,
      "zone": [
        "frontend/src/app/",
        "frontend/src/bootstrap/",
        "frontend/src/components/PersistentLight.tsx"
      ],
      "status": "done",
      "retries": 0,
      "repairs": 1,
      "repairFindings": [
        "Spec blocking: App.tsx styles removed the existing cinematic surface and pause-control styling without replacements; preserve the existing layout.",
        "Manifest blocking: PreparationScreen.tsx claims gaze works autonomously while tracker is disconnected; state that gaze response is unavailable."
      ],
      "handoffs": 0,
      "concerns": [],
      "startedAt": "2026-10-27T18:59:00+03:00",
      "tests": {
        "passed": 65,
        "failed": 0
      },
      "finishedAt": "2026-10-27T19:25:36+03:00",
      "review": "Manifest+Spec repair re-review clean; Craft repair re-review clean"
    },
    {
      "id": "04",
      "title": "Пролог: таймлайн, рукописные фразы и particle dissolve",
      "requirements": [
        "R12",
        "R13",
        "R14",
        "R15",
        "R16",
        "R17",
        "R54",
        "R55",
        "R56",
        "R57",
        "R58",
        "R59",
        "R60",
        "R61",
        "R62",
        "R63",
        "R64",
        "R65",
        "R66",
        "R67",
        "R68",
        "R69",
        "R70",
        "R71",
        "R72",
        "R73",
        "R74",
        "R75",
        "R76",
        "R77",
        "R78",
        "R79",
        "R80",
        "R81",
        "R82",
        "R83",
        "R91",
        "R104",
        "R105",
        "R106",
        "R111",
        "R112",
        "R114",
        "R115",
        "R116",
        "R151",
        "R152",
        "R153"
      ],
      "blockedBy": [
        "01",
        "03"
      ],
      "wave": 3,
      "zone": [
        "frontend/src/scenes/PrologueScene.tsx",
        "frontend/src/components/PrologueOverlay.tsx",
        "frontend/src/engine/film.ts",
        "frontend/src/engine/runtime.ts",
        "frontend/src/engine/filmConfig.ts"
      ],
      "status": "pending",
      "retries": 0,
      "repairs": 0,
      "repairFindings": [],
      "handoffs": 0,
      "concerns": []
    },
    {
      "id": "05",
      "title": "Storyboard v2.0 и итоговая сверка",
      "requirements": [
        "R03",
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
        "R117",
        "R118",
        "R119",
        "R120",
        "R121",
        "R122",
        "R123",
        "R124",
        "R125",
        "R126",
        "R127",
        "R128",
        "R129",
        "R130",
        "R131",
        "R132",
        "R133",
        "R134",
        "R135",
        "R136",
        "R137",
        "R138",
        "R139",
        "R140",
        "R141",
        "R142",
        "R143",
        "R144",
        "R158",
        "R159",
        "R160",
        "R161",
        "R162",
        "R163",
        "R164"
      ],
      "blockedBy": [
        "02",
        "03",
        "04"
      ],
      "wave": 4,
      "zone": [
        "A_Little_Universe_for_Vasilisa_Storyboard_v2.0.md",
        "README.md",
        "docs/"
      ],
      "status": "pending",
      "retries": 0,
      "repairs": 0,
      "repairFindings": [],
      "handoffs": 0,
      "concerns": []
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
    "gate": "G2",
    "status": "passed",
    "independentPasses": 3,
    "final": {
      "missing": 0,
      "halfCovered": 0,
      "outOfBrief": 0
    },
    "findings": [
      {
        "pass": 1,
        "type": "missing",
        "items": "R05-R11",
        "action": "Added an explicit pre-code review clause for all named documents and existing implementation areas."
      },
      {
        "pass": 1,
        "type": "out-of-brief",
        "items": "font file format/license detail",
        "action": "Removed WOFF2/OFL-specific constraint from the spec."
      },
      {
        "pass": 2,
        "type": "traceability",
        "items": "R01-R164",
        "action": "Added one row per ID with source excerpt and a clause-specific spec reference; refreshed manifest sections."
      },
      {
        "pass": 2,
        "type": "out-of-brief",
        "items": "keyframe/report-link requirement; extra switch labels; assistive-tech handling; fixed option count",
        "action": "Removed these unrequested constraints/details from the spec."
      }
    ],
    "found": 4,
    "fixed": 4,
    "deferred": 0
  },
  "concerns": [
    "таск 01 · config.ts:142 — competing partial updates during font load may drop one patch; review considered nonblocking.",
    "таск 01 · vite.config.ts:78 — transient network error may prevent serving a cached optional config; review considered nonblocking.",
    "таск 01 · fontCatalog.ts:49 — internal cmap parser/glyph data are exported and tested directly instead of remaining behind font readiness API; review considered nonblocking.",
    "Таск 02 · нет физической проверки на iPad; browser viewport emulation проверена.",
    "Таск 03 · текущий prologue seed будет удалён интеграцией таска 04, чтобы не показывать вторую точку.",
    "Таск 03 · preparation.css: media error and recording-ready note may overlap in the same absolute position.",
    "Таск 03 · PreparationScreen.test.ts checks absence of old inline light but not the app-level ready→prologue handoff; browser check covered center position manually.",
    "Таск 03 · Preloader.test.ts checks glow styling but not that count/movement/collapse settings leave actual manager progress unchanged.",
    "Таск 02 · export test asserts quality but not full nested config/schema version.",
    "Таск 02 · JSON rejection tests omit malformed text and unsupported schema version preserving the active config; these are nonblocking coverage gaps."
  ],
  "reviewers": {
    "manifestSpec": "review_01_manifest_spec",
    "craft": "review_01_craft"
  },
  "blind": null
};
