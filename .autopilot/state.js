window.STATE =
{
  "slug": "galaxy-camera-continuity",
  "dir": "2026-11-10-galaxy-camera-continuity",
  "title": "Бесшовная камера галактики",
  "mode": "full",
  "depth": "normal",
  "polish": null,
  "tier": "T0",
  "briefFile": "2026-11-10-brief.md",
  "memoryFile": "AGENTS.md",
  "skillDir": "C:/Users/McHomak/.agents/skills/autopilot",
  "startedAt": "2026-11-10T18:11:06+03:00",
  "updatedAt": "2026-11-10T18:56:52+03:00",
  "finishedAt": "2026-11-10T18:56:52+03:00",
  "stages": [
    {
      "id": "preflight",
      "status": "done",
      "startedAt": "2026-11-10T18:41:08+03:00",
      "finishedAt": "2026-11-10T18:41:08+03:00"
    },
    {
      "id": "manifest",
      "status": "done",
      "startedAt": "2026-11-10T18:41:08+03:00",
      "finishedAt": "2026-11-10T18:41:08+03:00"
    },
    {
      "id": "briefing",
      "status": "done",
      "startedAt": "2026-11-10T18:41:08+03:00",
      "finishedAt": "2026-11-10T18:41:08+03:00"
    },
    {
      "id": "spec",
      "status": "done",
      "startedAt": "2026-11-10T18:41:08+03:00",
      "finishedAt": "2026-11-10T18:42:05+03:00"
    },
    {
      "id": "plan",
      "status": "done",
      "startedAt": "2026-11-10T18:42:05+03:00",
      "finishedAt": "2026-11-10T18:42:05+03:00"
    },
    {
      "id": "build",
      "status": "done",
      "startedAt": "2026-11-10T18:42:05+03:00",
      "finishedAt": "2026-11-10T18:55:15+03:00"
    },
    {
      "id": "review",
      "status": "done",
      "startedAt": "2026-11-10T18:55:15+03:00",
      "finishedAt": "2026-11-10T18:55:15+03:00"
    },
    {
      "id": "final",
      "status": "done",
      "startedAt": "2026-11-10T18:55:15+03:00",
      "finishedAt": "2026-11-10T18:56:52+03:00"
    }
  ],
  "requirements": {
    "total": 4,
    "done": 4,
    "inTicket": 0,
    "inSpec": 0,
    "placeholder": 0,
    "deferred": 0,
    "dropped": 0
  },
  "tickets": [],
  "singlePass": {
    "status": "done",
    "startedAt": "2026-11-10T18:42:05+03:00",
    "files": [
      "frontend/src/engine/CameraDirector.tsx",
      "frontend/src/engine/cameraPoseContinuity.ts",
      "frontend/src/engine/cameraTimelineRevision.test.ts",
      "frontend/src/engine/runtime.ts",
      "frontend/src/engine/useSceneTimeline.ts",
      "frontend/src/engine/useSceneTimeline.test.ts"
    ],
    "tests": {
      "passed": 18,
      "failed": 0
    },
    "finishedAt": "2026-11-10T18:56:52+03:00",
    "commit": "655454a"
  },
  "tests": {
    "passed": 931,
    "failed": 1
  },
  "debt": {
    "placeholders": [],
    "assumptions": [],
    "emptyEnv": []
  },
  "additions": [],
  "concerns": [
    "Existing PreparationScreen consent test fails; existing Lily test typecheck error."
  ],
  "reviewers": {},
  "blind": {
    "checked": 2,
    "matched": 2,
    "mismatches": [],
    "note": "Camera distance sampled in live debug across the greeting transition; lifecycle also covered with real GSAP and clocks."
  }
};
