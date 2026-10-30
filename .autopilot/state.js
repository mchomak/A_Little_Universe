window.STATE =
{
  "slug": "lily-film-integration",
  "dir": "2026-10-30-lily-film-integration",
  "title": "Интеграция лилии в фильм",
  "mode": "full",
  "depth": "normal",
  "polish": null,
  "tier": "T1",
  "briefFile": "2026-10-30-brief.md",
  "memoryFile": "AGENTS.md",
  "skillDir": "C:/Users/McHomak/.agents/skills/autopilot",
  "startedAt": "2026-10-30T16:09:38+03:00",
  "updatedAt": "2026-10-30T19:04:14+03:00",
  "finishedAt": "2026-10-30T19:04:14+03:00",
  "stages": [
    {
      "id": "preflight",
      "status": "done",
      "startedAt": "2026-10-30T16:09:38+03:00",
      "finishedAt": "2026-10-30T16:09:38+03:00"
    },
    {
      "id": "manifest",
      "status": "done",
      "startedAt": "2026-10-30T16:10:25+03:00",
      "finishedAt": "2026-10-30T16:10:25+03:00"
    },
    {
      "id": "briefing",
      "status": "skipped",
      "note": "полный автомат — самобрифинг"
    },
    {
      "id": "spec",
      "status": "done",
      "startedAt": "2026-10-30T16:10:25+03:00",
      "finishedAt": "2026-10-30T16:10:25+03:00"
    },
    {
      "id": "plan",
      "status": "done",
      "startedAt": "2026-10-30T16:10:25+03:00",
      "finishedAt": "2026-10-30T16:10:25+03:00"
    },
    {
      "id": "build",
      "status": "done",
      "startedAt": "2026-10-30T16:09:38+03:00",
      "finishedAt": "2026-10-30T19:04:14+03:00"
    },
    {
      "id": "review",
      "status": "done",
      "startedAt": "2026-10-30T19:04:14+03:00",
      "finishedAt": "2026-10-30T19:04:14+03:00"
    },
    {
      "id": "final",
      "status": "done",
      "startedAt": "2026-10-30T19:04:14+03:00",
      "finishedAt": "2026-10-30T19:04:14+03:00"
    }
  ],
  "requirements": {
    "total": 13,
    "done": 13,
    "inTicket": 0,
    "inSpec": 0,
    "placeholder": 0,
    "deferred": 0,
    "dropped": 0
  },
  "tickets": [
    {
      "id": "01",
      "title": "Интеграция модели и анимаций",
      "status": "done",
      "startedAt": "2026-10-30T16:09:38+03:00",
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
        "R13"
      ],
      "wave": 1,
      "blockedBy": [],
      "repairs": 0,
      "handoffs": 0,
      "finishedAt": "2026-10-30T19:04:14+03:00"
    }
  ],
  "singlePass": null,
  "tests": {
    "status": "passed",
    "command": "npm run check",
    "result": "229 tests / 59 files; lint, typecheck, production build; repeated after merge into main"
  },
  "debt": {
    "placeholders": [],
    "assumptions": [],
    "emptyEnv": []
  },
  "additions": [],
  "coverage": {
    "status": "passed",
    "findings": 4,
    "resolved": "spec updated: continuous scene placement, inspector controls, checkpoint and final commit, browser verification",
    "reviewer": "/root/spec_check"
  },
  "concerns": [],
  "reviewers": {
    "manifestSpec": null,
    "craft": null
  },
  "blind": {
    "status": "passed",
    "reviewer": "/root/audit",
    "note": "Clips, model, duration controls and checkpoints confirmed. Merge and push were pending at review; main merge and post-merge checks completed subsequently. Browser visual checks performed by coordinator; physical iPad/Safari unverified."
  }
}
