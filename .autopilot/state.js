window.STATE =
{
  "slug": "film-skeleton",
  "dir": "2026-10-27-film-skeleton",
  "title": "A Little Universe: film skeleton",
  "mode": "full",
  "depth": "normal",
  "polish": null,
  "tier": "T2",
  "briefFile": "2026-10-27-brief.md",
  "memoryFile": "AGENTS.md",
  "skillDir": "C:/Users/McHomak/.agents/skills/autopilot",
  "startedAt": "2026-10-27T00:28:41.636755+03:00",
  "updatedAt": "2026-10-27T02:37:46.161556+03:00",
  "finishedAt": "2026-10-27T02:37:46.161556+03:00",
  "stages": [
    {
      "id": "preflight",
      "status": "done",
      "startedAt": "2026-10-27T00:28:41.636755+03:00",
      "finishedAt": "2026-10-27T00:30:35.548883+03:00"
    },
    {
      "id": "manifest",
      "status": "done",
      "startedAt": "2026-10-27T00:28:41.636755+03:00",
      "finishedAt": "2026-10-27T00:30:35.548883+03:00"
    },
    {
      "id": "briefing",
      "status": "done",
      "startedAt": "2026-10-27T00:28:41.636755+03:00",
      "finishedAt": "2026-10-27T00:30:35.548883+03:00",
      "note": "full: self-briefing"
    },
    {
      "id": "spec",
      "status": "done",
      "startedAt": "2026-10-27T00:28:41.636755+03:00",
      "finishedAt": "2026-10-27T00:30:35.548883+03:00"
    },
    {
      "id": "plan",
      "status": "done",
      "startedAt": "2026-10-27T00:28:41.636755+03:00",
      "finishedAt": "2026-10-27T00:30:35.548883+03:00"
    },
    {
      "id": "build",
      "status": "done",
      "startedAt": "2026-10-27T00:30:35.548883+03:00",
      "finishedAt": "2026-10-27T02:37:46.161556+03:00"
    },
    {
      "id": "review",
      "status": "done",
      "startedAt": "2026-10-27T00:37:54.833806+03:00",
      "finishedAt": "2026-10-27T02:37:46.161556+03:00"
    },
    {
      "id": "final",
      "status": "done",
      "startedAt": "2026-10-27T00:28:41.636755+03:00",
      "finishedAt": "2026-10-27T02:37:46.161556+03:00"
    }
  ],
  "requirements": {
    "total": 56,
    "done": 56,
    "inTicket": 0,
    "inSpec": 0,
    "placeholder": 0,
    "deferred": 0,
    "dropped": 0
  },
  "tickets": [
    {
      "id": "01",
      "title": "Film engine",
      "requirements": [
        "R07-R15",
        "R26",
        "R29",
        "R45",
        "R51-R53"
      ],
      "blockedBy": [],
      "wave": 1,
      "zone": [
        "engine/state-clock"
      ],
      "status": "done",
      "retries": 0,
      "repairs": 0,
      "handoffs": 0,
      "startedAt": "2026-10-27T00:30:35.548883+03:00",
      "tests": "npm test: 10 passed; typecheck/lint/build passed (executor)",
      "finishedAt": "2026-10-27T00:38:23.760857+03:00",
      "commit": null,
      "note": "Independent Manifest/Spec/Craft clean; no commit per local workflow"
    },
    {
      "id": "02",
      "title": "Scene modules and camera",
      "requirements": [
        "R06",
        "R10",
        "R16-R23",
        "R28",
        "R30",
        "R36-R39",
        "R46-R49"
      ],
      "blockedBy": [
        "01"
      ],
      "wave": 2,
      "zone": [
        "scenes",
        "engine/visuals"
      ],
      "status": "done",
      "retries": 0,
      "repairs": 1,
      "handoffs": 0,
      "startedAt": "2026-10-27T00:38:23.760857+03:00",
      "finishedAt": "2026-10-27T02:33:17.916657+03:00",
      "tests": "npm run check: 13 passed, typecheck/lint/build pass",
      "commit": null
    },
    {
      "id": "03",
      "title": "Viewer and Developer Mode",
      "requirements": [
        "R03-R05",
        "R16-R17",
        "R19",
        "R21",
        "R24-R27",
        "R31-R35",
        "R40-R44",
        "R47-R50"
      ],
      "blockedBy": [
        "01"
      ],
      "wave": 2,
      "zone": [
        "app",
        "debug",
        "components"
      ],
      "status": "done",
      "retries": 0,
      "repairs": 0,
      "handoffs": 0,
      "startedAt": "2026-10-27T00:38:23.760857+03:00",
      "finishedAt": "2026-10-27T02:33:17.916657+03:00",
      "tests": "npm run check: 13 passed, typecheck/lint/build pass",
      "commit": null
    },
    {
      "id": "04",
      "title": "Verification and documentation",
      "requirements": [
        "R01-R05",
        "R11",
        "R38",
        "R44",
        "R50-R56"
      ],
      "blockedBy": [
        "02",
        "03"
      ],
      "wave": 3,
      "zone": [
        "docs",
        "README",
        "verification"
      ],
      "status": "done",
      "retries": 0,
      "repairs": 0,
      "handoffs": 0,
      "startedAt": "2026-10-27T02:33:17.916657+03:00",
      "finishedAt": "2026-10-27T02:37:46.161556+03:00",
      "commit": null,
      "tests": "13 tests/7 files, lint/typecheck/build; full browser route, production, offline, touch/responsive"
    }
  ],
  "singlePass": null,
  "tests": {
    "command": "npm run check",
    "passed": 13,
    "failed": 0,
    "files": 7,
    "browser": "evidence/browser-report.json + browser-extra-report.json"
  },
  "debt": {
    "placeholders": [
      "3D art, photos, portrait, letter"
    ],
    "assumptions": [
      "Six gallery placeholders; 50s credits, manual ending; reload resets"
    ],
    "emptyEnv": []
  },
  "additions": [],
  "coverage": {
    "findings": 5,
    "resolved": 5,
    "note": "G2: motif, palette, seed, prologue prompt and documentation made explicit"
  },
  "concerns": [
    {
      "finding": "Vite bundle >500KB",
      "resolution": "reported in docs/verification.md; existing Three/GSAP baseline"
    },
    {
      "finding": "Physical tablet/Safari untested",
      "resolution": "reported in docs/verification.md"
    }
  ],
  "reviewers": {
    "manifestSpec": "/root/spec_review",
    "craft": "/root/craft_final"
  },
  "blind": {
    "verdict": "accepted",
    "missing": 0,
    "partial": 0,
    "documentationFinding": "resolved",
    "independentBrowserControl": false,
    "evidence": "root actual browser checks + independent code/evidence audit"
  }
}