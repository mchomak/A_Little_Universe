window.STATE =
{
  "slug": "lily-magical-growth-bloom",
  "dir": "2026-11-03-lily-magical-growth-bloom--wip",
  "title": "Lily 004 — магический рост и раскрытие",
  "mode": "full",
  "depth": "normal",
  "polish": null,
  "tier": "T1",
  "briefFile": "2026-11-03-brief.md",
  "memoryFile": "AGENTS.md",
  "skillDir": "C:\\Users\\McHomak\\.agents\\skills\\autopilot",
  "startedAt": "2026-11-03T14:59:03+03:00",
  "updatedAt": "2026-11-03T15:12:01+03:00",
  "finishedAt": null,
  "stages": [
    {
      "id": "preflight",
      "status": "done",
      "startedAt": "2026-11-03T14:59:03+03:00",
      "finishedAt": "2026-11-03T15:05:11+03:00"
    },
    {
      "id": "manifest",
      "status": "done",
      "finishedAt": "2026-11-03T15:05:11+03:00"
    },
    {
      "id": "briefing",
      "status": "skipped",
      "note": "полный автомат — самобрифинг; дополнительных вопросов нет"
    },
    {
      "id": "spec",
      "status": "done",
      "startedAt": "2026-11-03T15:05:11+03:00",
      "finishedAt": "2026-11-03T15:12:01+03:00"
    },
    {
      "id": "plan",
      "status": "done",
      "finishedAt": "2026-11-03T15:12:01+03:00"
    },
    {
      "id": "build",
      "status": "active",
      "startedAt": "2026-11-03T15:12:01+03:00"
    },
    {
      "id": "review",
      "status": "pending"
    },
    {
      "id": "final",
      "status": "pending"
    }
  ],
  "requirements": {
    "total": 69,
    "done": 0,
    "inTicket": 69,
    "inSpec": 0,
    "placeholder": 0,
    "deferred": 0,
    "dropped": 0
  },
  "tickets": [
    {
      "id": "01",
      "title": "Материалы и DEV-настройки",
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
        "R69"
      ],
      "blockedBy": [],
      "wave": 1,
      "zone": [
        "lily material/config"
      ],
      "status": "in-progress",
      "retries": 0,
      "repairs": 0,
      "handoffs": 0,
      "startedAt": "2026-11-03T15:12:01+03:00"
    },
    {
      "id": "02",
      "title": "Вихрь и пыльца",
      "requirements": [
        "R01",
        "R02",
        "R03",
        "R04",
        "R05",
        "R06",
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
        "R69"
      ],
      "blockedBy": [
        "01"
      ],
      "wave": 2,
      "zone": [
        "lily particles"
      ],
      "status": "pending",
      "retries": 0,
      "repairs": 0,
      "handoffs": 0
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
    "findings": 3,
    "resolved": 3,
    "notes": [
      "Dissipation begins only after full growth",
      "Vein can use local coordinates without suitable UV",
      "Preservation is comparison against fetched main; absence documented, no replacement effects"
    ]
  },
  "concerns": [],
  "reviewers": {
    "manifestSpec": null,
    "craft": null
  },
  "blind": null
}
