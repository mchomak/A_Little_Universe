window.STATE =
{
  "slug": "gallery-stabilization",
  "dir": "2026-10-30-gallery-stabilization--wip",
  "title": "???????????? ???????",
  "mode": "full",
  "depth": "normal",
  "polish": null,
  "tier": "T0",
  "briefFile": null,
  "memoryFile": "AGENTS.md",
  "skillDir": "C:/Users/McHomak/.agents/skills/autopilot",
  "startedAt": "2026-10-30T13:34:09+03:00",
  "updatedAt": "2026-10-30T14:02:30+03:00",
  "finishedAt": null,
  "stages": [
    {
      "id": "preflight",
      "status": "done"
    },
    {
      "id": "manifest",
      "status": "done"
    },
    {
      "id": "briefing",
      "status": "skipped"
    },
    {
      "id": "spec",
      "status": "done"
    },
    {
      "id": "plan",
      "status": "done"
    },
    {
      "id": "build",
      "status": "done",
      "startedAt": "2026-10-30T13:34:09+03:00",
      "finishedAt": "2026-10-30T14:02:30+03:00"
    },
    {
      "id": "review",
      "status": "active",
      "startedAt": "2026-10-30T14:02:30+03:00",
      "note": "??????????? ???????? ??????; ?????????? ???????? ??????????"
    },
    {
      "id": "final",
      "status": "pending"
    }
  ],
  "requirements": {
    "total": 5,
    "done": 4,
    "inTicket": 1,
    "inSpec": 0,
    "placeholder": 0,
    "deferred": 0,
    "dropped": 0
  },
  "tickets": [],
  "singlePass": {
    "startedAt": "2026-10-30T13:34:09+03:00",
    "files": [
      "frontend/src/components/GalleryOverlay.tsx",
      "frontend/src/scenes/GalleryScene.tsx",
      "frontend/src/scenes/gallery/controller.ts",
      "frontend/src/scenes/gallery/visibility.ts"
    ],
    "finishedAt": "2026-10-30T14:02:30+03:00",
    "tests": {
      "passed": 216,
      "failed": 0
    }
  },
  "tests": {
    "passed": 216,
    "failed": 0
  },
  "debt": {
    "placeholders": [],
    "assumptions": [],
    "emptyEnv": []
  },
  "additions": [],
  "coverage": null,
  "concerns": [
    "T03: ??????? ??????????? ???????? ?? ??????????????; ?????????? ??????? ??????, iPad ??????????.",
    "T02/T04: ?????????? ?????????? ???????? ? ????????? fade ?? ????????? ? ????????."
  ],
  "reviewers": {
    "manifestSpec": null,
    "craft": "review_tests"
  },
  "blind": null
}
