window.STATE =
{
  "slug": "review-selective-integration",
  "dir": "2026-11-05-review-selective-integration--wip",
  "title": "Review 02 / 04 / 05",
  "mode": "full",
  "depth": "normal",
  "polish": null,
  "tier": "T2",
  "briefFile": "2026-11-05-brief.md",
  "memoryFile": "AGENTS.md",
  "skillDir": "C:/Users/McHomak/.agents/skills/autopilot",
  "startedAt": "2026-11-05T16:43:00+03:00",
  "updatedAt": "2026-11-05T17:30:56+03:00",
  "finishedAt": null,
  "stages": [
    {
      "id": "preflight",
      "status": "done",
      "startedAt": "2026-11-05T16:43:00+03:00",
      "finishedAt": "2026-11-05T16:43:00+03:00"
    },
    {
      "id": "manifest",
      "status": "done",
      "startedAt": "2026-11-05T16:43:00+03:00",
      "finishedAt": "2026-11-05T16:43:00+03:00"
    },
    {
      "id": "briefing",
      "status": "done",
      "startedAt": "2026-11-05T16:43:00+03:00",
      "finishedAt": "2026-11-05T16:43:00+03:00"
    },
    {
      "id": "spec",
      "status": "done",
      "startedAt": "2026-11-05T16:43:00+03:00",
      "finishedAt": "2026-11-05T16:43:00+03:00"
    },
    {
      "id": "plan",
      "status": "done",
      "startedAt": "2026-11-05T16:43:00+03:00",
      "finishedAt": "2026-11-05T16:43:00+03:00"
    },
    {
      "id": "build",
      "status": "done",
      "startedAt": "2026-11-05T16:43:00+03:00",
      "finishedAt": "2026-11-05T17:30:56+03:00"
    },
    {
      "id": "review",
      "status": "done",
      "startedAt": "2026-11-05T17:16:03+03:00",
      "finishedAt": "2026-11-05T17:30:56+03:00"
    },
    {
      "id": "final",
      "status": "active",
      "startedAt": "2026-11-05T17:30:56+03:00"
    }
  ],
  "tickets": [
    {
      "id": "01",
      "title": "Seed audit",
      "requirements": [
        "R04"
      ],
      "wave": 1,
      "zone": "seed",
      "status": "done",
      "startedAt": "2026-11-05T16:46:08+03:00",
      "finishedAt": "2026-11-05T16:46:08+03:00",
      "note": "No seed changes in source"
    },
    {
      "id": "02",
      "title": "Portrait",
      "requirements": [
        "R05"
      ],
      "wave": 2,
      "zone": "identity",
      "status": "done",
      "startedAt": "2026-11-05T16:46:08+03:00",
      "note": "9b72f6d, 4b8181d, 475fdd9",
      "finishedAt": "2026-11-05T17:30:56+03:00"
    },
    {
      "id": "03",
      "title": "Gallery",
      "requirements": [
        "R06"
      ],
      "wave": 2,
      "zone": "gallery",
      "status": "done",
      "startedAt": "2026-11-05T16:46:08+03:00",
      "note": "7ed6565",
      "finishedAt": "2026-11-05T17:30:56+03:00"
    },
    {
      "id": "04",
      "title": "Regression audit",
      "requirements": [
        "R10",
        "R11",
        "R12",
        "R13"
      ],
      "wave": 3,
      "zone": "verification",
      "status": "in-progress",
      "startedAt": "2026-11-05T17:16:03+03:00"
    }
  ],
  "coverage": {
    "findings": 3,
    "resolved": 3
  },
  "acceptance": {
    "finding": "saved arch Z ignored",
    "resolution": "fixed in b191f80; independently rechecked"
  }
}
