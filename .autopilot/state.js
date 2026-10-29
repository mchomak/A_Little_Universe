window.STATE =
{
  "slug": "scene04-portrait-direct",
  "dir": "2026-10-29-scene04-portrait-direct",
  "title": "Сцена 04 — лилия напрямую в портрет",
  "mode": "full",
  "depth": "normal",
  "polish": null,
  "tier": "T1",
  "briefFile": "2026-10-29-brief.md",
  "memoryFile": "AGENTS.md",
  "skillDir": "C:/Users/McHomak/.agents/skills/autopilot",
  "startedAt": "2026-10-29T23:09:42+03:00",
  "updatedAt": "2026-10-29T23:41:04+03:00",
  "finishedAt": "2026-10-29T23:41:04+03:00",
  "stages": [
    {
      "id": "preflight",
      "status": "done",
      "startedAt": "2026-10-29T23:09:42+03:00",
      "finishedAt": "2026-10-29T23:09:42+03:00"
    },
    {
      "id": "manifest",
      "status": "done",
      "startedAt": "2026-10-29T23:09:42+03:00",
      "finishedAt": "2026-10-29T23:11:47+03:00"
    },
    {
      "id": "briefing",
      "status": "skipped",
      "note": "полный автомат — самобрифинг"
    },
    {
      "id": "spec",
      "status": "done",
      "startedAt": "2026-10-29T23:11:47+03:00",
      "finishedAt": "2026-10-29T23:12:49+03:00"
    },
    {
      "id": "plan",
      "status": "done",
      "startedAt": "2026-10-29T23:12:49+03:00",
      "note": "T1, один связный таск: таймлайн и renderer меняют одни файлы.",
      "finishedAt": "2026-10-29T23:14:03+03:00"
    },
    {
      "id": "build",
      "status": "done",
      "startedAt": "2026-10-29T23:14:03+03:00",
      "note": "Direct scene04 committed19edf41; all118 tests pass.",
      "finishedAt": "2026-10-29T23:36:14+03:00"
    },
    {
      "id": "review",
      "status": "done",
      "startedAt": "2026-10-29T23:21:27+03:00",
      "note": "Manifest+spec clean; Craft has no blocking findings; root visual acceptance completed.",
      "finishedAt": "2026-10-29T23:36:14+03:00"
    },
    {
      "id": "final",
      "status": "done",
      "startedAt": "2026-10-29T23:36:14+03:00",
      "finishedAt": "2026-10-29T23:41:04+03:00",
      "note": "Independent acceptance A-G pass; final commit and clean-status evidence in final response."
    }
  ],
  "requirements": {
    "total": 42,
    "done": 40,
    "inTicket": 0,
    "inSpec": 0,
    "placeholder": 1,
    "deferred": 1,
    "dropped": 0
  },
  "tickets": [
    {
      "id": "01",
      "title": "Прямое превращение лилии в портрет",
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
        "R42"
      ],
      "blockedBy": [],
      "wave": 1,
      "zone": [
        "frontend/scene04",
        "identity-only engine/overlay",
        "docs/scene-04-portrait-direct.md"
      ],
      "status": "done",
      "retries": 0,
      "repairs": 2,
      "handoffs": 0,
      "startedAt": "2026-10-29T23:14:03+03:00",
      "repairFindings": [
        "Browser t8/t10 face too dark; corrected tonal encoding and original underlay.",
        "Craft: reduced-motion travel, duration-derived tests, photo SHA and target/reveal/dispose assertions."
      ],
      "finishedAt": "2026-10-29T23:36:14+03:00",
      "commit": "19edf41a32ae100f7fcad99ac889ae323c287240",
      "tests": {
        "command": "npm run check",
        "passed": 118,
        "failed": 0,
        "files": 30
      }
    }
  ],
  "singlePass": null,
  "tests": {
    "command": "npm run check",
    "passed": 118,
    "failed": 0,
    "files": 30,
    "lint": "passed",
    "typecheck": "passed",
    "productionBuild": "passed"
  },
  "debt": {
    "placeholders": [
      "Existing procedural Lily and mock sample source; final GLB/same live mesh dissolve and scene03 camera remain pending per brief."
    ],
    "assumptions": [
      "A01: работа от чистого HEAD 01c4d925, чужие незакоммиченные изменения не копируются.",
      "A02: новые утверждённые keyframes и названные текущие screenshots не предоставлены.",
      "A03: монтаж21s; frame13.5–15, последний интервал удерживает стабильный handoff."
    ],
    "emptyEnv": []
  },
  "additions": [],
  "coverage": {
    "gate": "G2",
    "status": "passed",
    "independentPasses": 2,
    "found": 8,
    "fixed": 8,
    "notes": "Audit/isolation and explicit acceptance criteria added. Source-derived API choices explained. Manifest Unicode repaired after code review."
  },
  "concerns": [
    "Final GLB/same live mesh dissolve and scene03 camera await integration.",
    "Named user screenshots not attached; comparison uses committed baseline.",
    "Physical iPad/Safari unverified.",
    "sync.py server unavailable on Windows (ps missing); snapshot mode used.",
    "Deferred test precision: independent fixed world-coordinate samples, dedicated reduced-motion shader test and explicit hashed-asset import binding; current behavior checked through source/browser and immutable-file SHA tests.",
    "No GPU heap growth or physical-device performance benchmark was performed; scene cleanup verified by source/runtime tests and repeat-entry visual equality.",
    "Blind G4: no scene mount render assertion; visual/shader/camera regressions still require browser QA. Actual finished browser scenario passed independently."
  ],
  "reviewers": {
    "manifestSpec": "/root/spec_gate",
    "craft": "/root/craft_review"
  },
  "blind": {
    "status": "accepted",
    "A": "pass",
    "B": "pass",
    "C": "pass",
    "D": "pass",
    "E": "pass: matched remount",
    "F": "pass for tested paths",
    "G": "pass: root npm run check118/30",
    "H": "Final commit, branch and clean status verified by coordinator after record commit; output in final response.",
    "mismatches": [],
    "limits": [
      "Real GLB/same object integration pending by brief.",
      "Physical iPad/Safari and GPU profiling not performed.",
      "Automated suite does not mount R3F scene; final appearance and handoff checked in actual browsers."
    ]
  }
}
