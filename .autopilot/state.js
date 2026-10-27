window.STATE =
{
  "slug": "opening-scenes-v2",
  "dir": "2026-10-27-opening-scenes-v2",
  "title": "Сцены 00, 00.1 и 01 — художественная версия 2.0",
  "mode": "full",
  "depth": "normal",
  "polish": null,
  "tier": "T2",
  "briefFile": "2026-10-27-brief.md",
  "memoryFile": "AGENTS.md",
  "skillDir": "C:/Users/McHomak/.agents/skills/autopilot",
  "startedAt": "2026-10-27T17:46:48+03:00",
  "updatedAt": "2026-10-28T00:07:37+03:00",
  "finishedAt": "2026-10-28T00:07:37+03:00",
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
      "note": "7 tickets; последующие дозавершения 06 и 07 после blind acceptance"
    },
    {
      "id": "build",
      "status": "done",
      "startedAt": "2026-10-27T18:33:31+03:00",
      "finishedAt": "2026-10-28T00:07:37+03:00",
      "note": "7 из 7 tickets готовы; продуктовые изменения ограничены общей инфраструктурой и сценами 00, 00.1 и 01"
    },
    {
      "id": "review",
      "status": "done",
      "startedAt": "2026-10-27T18:53:25+03:00",
      "finishedAt": "2026-10-28T00:07:37+03:00",
      "note": "Manifest+Spec/Craft повторно чистые; G4 находки устранены; итоговая слепая проверка выполнена"
    },
    {
      "id": "final",
      "status": "done",
      "startedAt": "2026-10-27T23:54:01+03:00",
      "finishedAt": "2026-10-28T00:07:37+03:00"
    }
  ],
  "requirements": {
    "total": 164,
    "done": 164,
    "inTicket": 0,
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
      "lastHandoff": ".autopilot/2026-10-27-opening-scenes-v2/handoff-02-1.md",
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
      "review": "Manifest+Spec repair re-review clean; Craft repair re-review clean",
      "commit": "56b78c7"
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
        "frontend/src/engine/filmConfig.ts",
        "frontend/src/components/PersistentLight.tsx",
        "frontend/src/components/PersistentLight.test.tsx"
      ],
      "status": "done",
      "retries": 0,
      "repairs": 2,
      "repairFindings": [
        "Manifest+Spec blocking: particles stay at opacity 1 after dissolve into infinite wait; only the central point may remain.",
        "Manifest+Spec blocking: add a public-seam test proving seek/replay cannot expose partial reveal or dissolve state.",
        "Root browser QA blocking: at portrait 768×1024 and landscape 1024×768 around t=12s, the second phrase intersects the central light, so the light is not visually between the text blocks; restore a responsive clear gap and add a layout seam assertion."
      ],
      "handoffs": 1,
      "concerns": [],
      "startedAt": "2026-10-27T19:26:08+03:00",
      "lastHandoff": ".autopilot/2026-10-27-opening-scenes-v2/handoff-04-1.md",
      "tests": {
        "passed": 77,
        "failed": 0
      },
      "finishedAt": "2026-10-27T20:03:03+03:00",
      "review": "Manifest+Spec final repair re-review pass; Craft repair review nonblocking only",
      "commit": "470ccde"
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
      "status": "done",
      "retries": 0,
      "repairs": 0,
      "repairFindings": [],
      "handoffs": 0,
      "concerns": [],
      "startedAt": "2026-10-27T20:03:32+03:00",
      "finishedAt": "2026-10-27T20:16:19+03:00",
      "tests": {
        "passed": 77,
        "failed": 0
      },
      "review": "Manifest+Spec and Craft clean; browser viewport QA; backend 3/3",
      "commit": "6589195"
    },
    {
      "id": "06",
      "title": "Scene Composer: параметры 00.1 и доля возврата частиц",
      "requirements": [
        "R90",
        "R91",
        "R92",
        "R154"
      ],
      "blockedBy": [],
      "wave": 4,
      "zone": [
        "frontend/src/systems/scene-config/",
        "frontend/src/debug/",
        "frontend/src/app/PreparationScreen.tsx",
        "frontend/src/app/preparation.css",
        "tests",
        "storyboard and technical docs"
      ],
      "status": "done",
      "retries": 0,
      "repairs": 2,
      "repairFindings": [
        "Continuation fixed GraphicsFallback test props inference after first full check.",
        "G4 repair corrected preparation spacing label, stale 77/21 report count, and missing Composer viewport record."
      ],
      "handoffs": 1,
      "concerns": [
        "T06 · DeveloperPanel.tsx particle return display scale uses 20 separately from renderer cap; review considered nonblocking."
      ],
      "startedAt": "2026-10-27T20:29:54+03:00",
      "finishedAt": "2026-10-28T00:07:37+03:00",
      "tests": {
        "passed": 83,
        "failed": 0
      },
      "review": "Manifest+Spec repair re-review all addressed; Craft repair review clean",
      "commit": "fa9682c"
    },
    {
      "id": "07",
      "title": "Синхронизация verification отчёта после G4",
      "requirements": [
        "R136",
        "R141",
        "R142"
      ],
      "blockedBy": [
        "06"
      ],
      "wave": 4,
      "zone": [
        "docs/verification.md"
      ],
      "status": "done",
      "retries": 0,
      "repairs": 0,
      "repairFindings": [],
      "handoffs": 0,
      "concerns": [],
      "startedAt": "2026-10-27T20:49:00+03:00",
      "finishedAt": "2026-10-28T00:07:37+03:00",
      "tests": {
        "passed": 83,
        "failed": 0
      },
      "review": "Manifest+Spec and Craft clean; documentation aligned; browser JSON validation/reset recorded",
      "commit": "09764c2"
    }
  ],
  "singlePass": null,
  "tests": {
    "passed": 83,
    "failed": 0,
    "files": 23,
    "frontend": "npm run check",
    "backend": {
      "passed": 3,
      "failed": 0,
      "command": ".\\.venv\\Scripts\\python.exe -m pytest -q (from backend)"
    }
  },
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
    "REPORT: No physical iPad/Safari, offline reload, repeated GPU-memory stress, or long device run; browser viewport emulation only. Validate these on the target iPad.",
    "REPORT: rapid config updates during font readiness may race and lose one partial patch; nonblocking review concern, no reproduction in current checks.",
    "DROP: optional startup-config fetch failure already falls back to defaults; source and tests cover this path.",
    "DROP: exported cmap parser/glyph internals are an encapsulation concern only; font readiness and glyph coverage are tested.",
    "DROP: obsolete pre-T04 second-point seed concern was superseded by the single persistent app-level light.",
    "REPORT: live prologue config revisions can rebuild glyph-mask/particle buffers; monitor on iPad while tuning and consider narrowing rebuild dependencies if it stutters.",
    "REPORT: extremely narrow/tall copy layouts beyond tested tablet viewport sizes have no explicit clamp; check on actual iPad orientations.",
    "DROP: app-level ready-to-prologue handoff was manually verified in browser at both viewport orientations.",
    "DROP: earlier combined reveal/particle fixed-frame test gap was covered by deterministic seek/replay assertions.",
    "REPORT: no dedicated browser export/download round-trip or production offline reload was performed; serializer/startup paths have unit coverage, and browser import/reset was manually checked.",
    "REPORT: the particle-return UI scale and renderer 20% ceiling are duplicated constants; they match currently and the default 15% is verified."
  ],
  "reviewers": {
    "manifestSpec": "review_05_manifest_spec; tickets 06–07 re-review clean",
    "craft": "review_05_craft; ticket 06–07 clean"
  },
  "blind": {
    "status": "partial",
    "checker": "blind_acceptance_recheck",
    "result": "No functional mismatch surfaced. Source, tests and docs support the implementation; remaining gaps are verification limits listed below.",
    "implemented": [
      "typography/offline asset integration",
      "scene 00.1 and persistent center light",
      "scene 01 timeline, glyph dissolve and deterministic replay",
      "Composer schema/partial startup overrides/normalization",
      "pause, seek, restart and disposal paths",
      "storyboard v2.0; sections 02–08 match v1.1 and section 09 differs only by blank lines"
    ],
    "manual_browser_checks": [
      "preparation-to-prologue center handoff at 1024x768 and 768x1024",
      "live font selection and prologue frames at 4, 12 and 21 seconds",
      "partial JSON import, malformed JSON rejection without config loss, and reset to defaults"
    ],
    "limitations": [
      "no physical iPad/Safari or hardware GPU profiling",
      "no repeated GPU-memory stress run",
      "no production offline reload or browser export/download round trip",
      "no direct pre-change source diff from the blind checker; root verified product diff paths contain no scene 02–09 module"
    ],
    "checks": {
      "frontend": "npm run check: ESLint, typecheck app/node, 83 tests across 23 files, production build passed",
      "backend": "pytest 3 passed",
      "buildWarnings": [
        "App chunk 687.39 kB (195.04 kB gzip)",
        "Three.js CommonJS deprecation warning"
      ]
    }
  },
  "closeout": {
    "result": "Сцены 00, 00.1 и 01 обновлены; Scene Composer и JSON-конфигурация завершены; создан Storyboard v2.0; 164/164 требований закрыты.",
    "assumptions": [],
    "deferred": [],
    "dropped": [],
    "additions": [],
    "openQuestions": [
      "Проверить на физическом iPad/Safari обе ориентации, касания, safe areas, долгий GPU/memory прогон и автономный запуск."
    ]
  }
};
