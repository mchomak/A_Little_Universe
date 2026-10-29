window.STATE =
{
  "slug": "lily004-refinement",
  "dir": "2026-10-29-lily004-refinement--wip",
  "title": "Лилия 004 — геометрия, материалы и анимация",
  "mode": "full",
  "depth": "normal",
  "polish": null,
  "tier": "T1",
  "briefFile": "2026-10-29-brief.md",
  "memoryFile": "AGENTS.md",
  "skillDir": "C:/Users/McHomak/.agents/skills/autopilot",
  "startedAt": "2026-10-29T20:19:14+03:00",
  "updatedAt": "2026-10-29T22:05:22+03:00",
  "finishedAt": null,
  "stages": [
    {
      "status": "done",
      "id": "preflight",
      "startedAt": "2026-10-29T20:19:14+03:00",
      "finishedAt": "2026-10-29T20:22:48+03:00"
    },
    {
      "status": "done",
      "id": "manifest",
      "startedAt": "2026-10-29T20:22:48+03:00",
      "finishedAt": "2026-10-29T20:28:13+03:00"
    },
    {
      "status": "skipped",
      "id": "briefing",
      "note": "полный автомат — самобрифинг"
    },
    {
      "status": "done",
      "id": "spec",
      "startedAt": "2026-10-29T20:28:13+03:00",
      "finishedAt": "2026-10-29T20:33:45+03:00"
    },
    {
      "status": "done",
      "id": "plan",
      "startedAt": "2026-10-29T20:33:45+03:00",
      "finishedAt": "2026-10-29T20:34:55+03:00"
    },
    {
      "status": "active",
      "id": "build",
      "startedAt": "2026-10-29T20:34:55+03:00"
    },
    {
      "status": "active",
      "id": "review",
      "startedAt": "2026-10-29T21:22:57+03:00"
    },
    {
      "status": "pending",
      "id": "final"
    }
  ],
  "requirements": {
    "total": 61,
    "done": 11,
    "inSpec": 0,
    "deferred": 0,
    "inTicket": 50,
    "dropped": 0,
    "placeholder": 0
  },
  "tickets": [
    {
      "wave": 1,
      "repairs": 0,
      "requirements": [
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
        "R28",
        "R29",
        "R30",
        "R31",
        "R32",
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
        "R48"
      ],
      "retries": 1,
      "id": "01",
      "blockedBy": [],
      "title": "Геометрия и живое движение",
      "zone": [
        "geometry"
      ],
      "handoffs": 1,
      "status": "in-progress",
      "startedAt": "2026-10-29T20:34:55+03:00",
      "tests": {
        "note": "Profile-only pass; dense red: endpoint assertion and tiny-triangle diagnosis; fresh continuation",
        "failed": 2,
        "passed": 1
      },
      "agent": "/root/lily_geometry_finish"
    },
    {
      "wave": 1,
      "repairs": 1,
      "requirements": [
        "R19",
        "R20",
        "R21",
        "R22",
        "R23",
        "R24",
        "R25",
        "R26",
        "R27",
        "R33",
        "R34",
        "R35",
        "R43",
        "R44",
        "R45",
        "R46",
        "R47",
        "R48"
      ],
      "retries": 0,
      "id": "02",
      "blockedBy": [],
      "title": "PBR и созревание цвета",
      "zone": [
        "materials"
      ],
      "handoffs": 1,
      "status": "done",
      "startedAt": "2026-10-29T20:34:55+03:00",
      "tests": {
        "passed": 22,
        "failed": 0,
        "note": "9 unit +13HTTP; contract2curves/7maps, Blender reimport6materials/7decodedimages; Craft clean"
      },
      "agent": "/root/lily_materials_finish",
      "finishedAt": "2026-10-29T22:05:22+03:00"
    },
    {
      "wave": 2,
      "repairs": 0,
      "requirements": [
        "R01",
        "R02",
        "R03",
        "R04",
        "R05",
        "R06",
        "R07",
        "R08",
        "R17",
        "R35",
        "R36",
        "R40",
        "R41",
        "R42",
        "R43",
        "R44",
        "R45",
        "R49",
        "R50",
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
        "R61"
      ],
      "retries": 0,
      "id": "03",
      "blockedBy": [
        "01",
        "02"
      ],
      "title": "Экспорт, сравнение и HANDOFF",
      "zone": [
        "final-verification"
      ],
      "handoffs": 0,
      "status": "pending"
    }
  ],
  "singlePass": null,
  "tests": null,
  "debt": {
    "emptyEnv": [],
    "placeholders": [],
    "assumptions": [
      "v2_04m source; v13 visual baseline",
      "Growth9s / Bloom8s",
      "Blender material curve + deterministic GLB extras/JSON runtime contract"
    ]
  },
  "additions": [],
  "coverage": {
    "extras": "Engineering decisions deepen existing requirements, no new capability",
    "resolved": [
      "S1 explicitly distinguishes current screenshots and art palette/mood references",
      "S1 documents actual behavior of each baseline clip and requires final report"
    ],
    "status": "passed",
    "findings": 2,
    "missingAfterRecheck": 0,
    "reviewer": "/root/lily_spec_gate"
  },
  "concerns": [
    {
      "ticket": "02",
      "axis": "craft",
      "decision": "fix-now",
      "status": "resolved",
      "finding": "Protect GLB inputs from overlapping report output; restore preview render settings; assert complete maturation metadata semantics; test real loopback startup binding.",
      "reason": "Bounded regression repairs protect R08/R35/R43/R50 and cost less to close before export assembly."
    },
    {
      "ticket": "01",
      "axis": "geometry",
      "decision": "fix-now",
      "status": "in-progress",
      "finding": "Stronger terminal sculpt produced 986 normal reversals outside attachment; reduce terminal offsets before acceptance.",
      "reason": "User requires smooth fold-free intermediate motion; numeric profile improvements alone are insufficient."
    }
  ],
  "reviewers": {
    "craft": "/root/lily_craft_reviewer",
    "manifestSpec": "/root/lily_spec_gate"
  },
  "blind": null,
  "worktree": "C:\\Users\\McHomak\\.codex\\worktrees\\lily004-refinement\\A_Little_Universe",
  "branch": "codex/lily004-refinement",
  "scope": "Existing Blender lily assets only; frontend untouched",
  "preview": {
    "material": "http://127.0.0.1:5182/scripts/viewer.html?asset=final",
    "rootIabPreview": 2,
    "dashboard": "http://127.0.0.1:5181/.autopilot/dashboard.html",
    "materialSession": 13442,
    "rootIabOriginal": 1
  }
}
