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
  "updatedAt": "2026-10-29T20:34:55+03:00",
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
      "status": "pending",
      "id": "review"
    },
    {
      "status": "pending",
      "id": "final"
    }
  ],
  "requirements": {
    "total": 61,
    "done": 0,
    "inSpec": 0,
    "deferred": 0,
    "inTicket": 61,
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
      "retries": 0,
      "id": "01",
      "blockedBy": [],
      "title": "Геометрия и живое движение",
      "zone": [
        "geometry"
      ],
      "handoffs": 0,
      "status": "in-progress",
      "startedAt": "2026-10-29T20:34:55+03:00"
    },
    {
      "wave": 1,
      "repairs": 0,
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
      "handoffs": 0,
      "status": "in-progress",
      "startedAt": "2026-10-29T20:34:55+03:00"
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
  "concerns": [],
  "reviewers": {
    "craft": null,
    "manifestSpec": null
  },
  "blind": null,
  "worktree": "C:\\Users\\McHomak\\.codex\\worktrees\\lily004-refinement\\A_Little_Universe",
  "branch": "codex/lily004-refinement",
  "scope": "Existing Blender lily assets only; frontend untouched"
}
