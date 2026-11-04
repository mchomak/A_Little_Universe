window.STATE =
{
  "slug": "portrait-photo-reveal",
  "dir": "2026-11-04-portrait-photo-reveal",
  "title": "Проявление фотографии из портрета",
  "mode": "full",
  "depth": "normal",
  "polish": null,
  "tier": "T0",
  "briefFile": "2026-11-04-brief.md",
  "memoryFile": "AGENTS.md",
  "skillDir": "C:/Users/McHomak/.agents/skills/autopilot",
  "startedAt": "2026-11-04T12:02:37+03:00",
  "updatedAt": "2026-11-04T14:41:43+03:00",
  "finishedAt": "2026-11-04T14:41:43+03:00",
  "stages": [
    {
      "id": "preflight",
      "status": "done",
      "startedAt": "2026-11-04T12:02:37+03:00",
      "finishedAt": "2026-11-04T12:15:22+03:00"
    },
    {
      "id": "manifest",
      "status": "done",
      "startedAt": "2026-11-04T12:15:22+03:00",
      "finishedAt": "2026-11-04T12:15:22+03:00"
    },
    {
      "id": "briefing",
      "status": "skipped",
      "startedAt": "2026-11-04T12:15:22+03:00",
      "finishedAt": "2026-11-04T12:15:22+03:00",
      "note": "full"
    },
    {
      "id": "spec",
      "status": "done",
      "startedAt": "2026-11-04T12:15:22+03:00",
      "finishedAt": "2026-11-04T12:19:11+03:00"
    },
    {
      "id": "plan",
      "status": "skipped",
      "startedAt": "2026-11-04T12:19:11+03:00",
      "finishedAt": "2026-11-04T12:19:11+03:00",
      "note": "T0"
    },
    {
      "id": "build",
      "status": "done",
      "startedAt": "2026-11-04T12:19:11+03:00",
      "finishedAt": "2026-11-04T14:41:43+03:00"
    },
    {
      "id": "review",
      "status": "done",
      "startedAt": "2026-11-04T14:41:43+03:00",
      "finishedAt": "2026-11-04T14:41:43+03:00"
    },
    {
      "id": "final",
      "status": "done",
      "startedAt": "2026-11-04T14:41:43+03:00",
      "finishedAt": "2026-11-04T14:41:43+03:00"
    }
  ],
  "requirements": {
    "total": 7,
    "done": 6,
    "inTicket": 0,
    "inSpec": 1,
    "placeholder": 0,
    "deferred": 0,
    "dropped": 0
  },
  "tickets": [],
  "singlePass": {
    "startedAt": "2026-11-04T12:19:11+03:00"
  },
  "tests": {
    "command": "npm run check",
    "result": "passed: 112 files, 589 tests; lint, typecheck, production build"
  },
  "debt": {
    "placeholders": [],
    "assumptions": [],
    "emptyEnv": []
  },
  "additions": [],
  "coverage": {
    "found": 0,
    "fixed": 0
  },
  "concerns": [],
  "reviewers": {
    "manifestSpec": null,
    "craft": "Code review passed; browser smoke did not confirm worker completion after settings change."
  },
  "blind": "Independent browser acceptance unavailable due to browser contention; coordinator inspected screenshots."
}
