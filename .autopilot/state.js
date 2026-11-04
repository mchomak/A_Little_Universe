window.STATE = {
  "slug": "gallery-memories",
  "dir": "2026-11-04-gallery-memories",
  "title": "Галерея воспоминаний и коллажи",
  "mode": "full",
  "depth": "normal",
  "polish": null,
  "tier": "T1",
  "briefFile": "2026-11-04-brief.md",
  "memoryFile": "AGENTS.md",
  "skillDir": "C:/Users/McHomak/.agents/skills/autopilot",
  "startedAt": "2026-11-04T12:16:37+03:00",
  "updatedAt": "2026-11-04T15:09:24+03:00",
  "finishedAt": "2026-11-04T15:09:24+03:00",
  "stages": [
    {
      "id": "preflight",
      "status": "done",
      "startedAt": "2026-11-04T12:16:37+03:00",
      "finishedAt": "2026-11-04T15:09:24+03:00"
    },
    {
      "id": "manifest",
      "status": "done",
      "startedAt": "2026-11-04T12:16:37+03:00",
      "finishedAt": "2026-11-04T15:09:24+03:00"
    },
    {
      "id": "briefing",
      "status": "done",
      "startedAt": "2026-11-04T12:16:37+03:00",
      "finishedAt": "2026-11-04T15:09:24+03:00"
    },
    {
      "id": "spec",
      "status": "done",
      "startedAt": "2026-11-04T12:16:37+03:00",
      "finishedAt": "2026-11-04T15:09:24+03:00"
    },
    {
      "id": "plan",
      "status": "done",
      "startedAt": "2026-11-04T12:16:37+03:00",
      "finishedAt": "2026-11-04T15:09:24+03:00"
    },
    {
      "id": "build",
      "status": "done",
      "startedAt": "2026-11-04T12:16:37+03:00",
      "finishedAt": "2026-11-04T15:09:24+03:00"
    },
    {
      "id": "review",
      "status": "done",
      "startedAt": "2026-11-04T12:16:37+03:00",
      "finishedAt": "2026-11-04T15:09:24+03:00"
    },
    {
      "id": "final",
      "status": "done",
      "startedAt": "2026-11-04T12:16:37+03:00",
      "finishedAt": "2026-11-04T15:09:24+03:00"
    }
  ],
  "requirements": {
    "total": 16,
    "done": 15,
    "inTicket": 0,
    "inSpec": 0,
    "placeholder": 0,
    "deferred": 1,
    "dropped": 0
  },
  "tickets": [
    {
      "id": "01",
      "title": "Данные и подписи",
      "requirements": [
        "R01",
        "R02",
        "R03",
        "R05",
        "R06",
        "R07",
        "R08",
        "R09",
        "R13",
        "R14",
        "R15"
      ],
      "blockedBy": [],
      "wave": 1,
      "zone": [
        "frontend/src/scenes/gallery/content.ts",
        "frontend/src/data/"
      ],
      "status": "done",
      "startedAt": "2026-11-04T12:16:37+03:00",
      "retries": 0,
      "repairs": 2,
      "handoffs": 0,
      "commit": "305b7ff",
      "finishedAt": "2026-11-04T14:36:38+03:00",
      "tests": {
        "passed": 31,
        "failed": 0
      }
    },
    {
      "id": "02",
      "title": "Коллаж и фокус",
      "requirements": [
        "R06",
        "R07",
        "R09",
        "R10",
        "R11",
        "R12",
        "R14",
        "R15"
      ],
      "blockedBy": [],
      "wave": 1,
      "zone": [
        "frontend/src/scenes/GalleryScene.tsx",
        "frontend/src/scenes/gallery/collage.ts",
        "frontend/src/scenes/gallery/collage.test.ts",
        "frontend/src/scenes/gallery/world.ts",
        "frontend/src/scenes/gallery/world.test.ts"
      ],
      "status": "done",
      "startedAt": "2026-11-04T12:16:37+03:00",
      "retries": 0,
      "repairs": 2,
      "handoffs": 0,
      "commit": "289b8b6",
      "finishedAt": "2026-11-04T14:36:38+03:00",
      "tests": {
        "passed": 20,
        "failed": 0
      }
    }
  ],
  "singlePass": null,
  "tests": {
    "passed": 488,
    "failed": 0,
    "files": 97,
    "lint": "passed",
    "typecheck": "passed",
    "build": "passed"
  },
  "debt": {
    "placeholders": [
      "Папки 2026_01_Country_House_New_Year и 2026_09_Annas_Birthday содержат только видео; оставлены маркеры плейсхолдеров без фото."
    ],
    "assumptions": [
      "Событийных папок не оказалось в origin/main/images; 74 JPG скопированы без изменений из соседнего локального worktree feature/scene-04-vortex-portrait.",
      "Пустая 2026_08_Asia_Trip пропущена по более позднему указанию из блока «Размещение в галерее»; более ранняя просьба о плейсхолдере отложена (R04)."
    ],
    "emptyEnv": []
  },
  "additions": [],
  "coverage": null,
  "concerns": [],
  "reviewers": {
    "manifestSpec": "/root/gallery_t01_manifest_review",
    "craft": "/root/gallery_t01_craft_review"
  },
  "blind": {
    "verdict": "runtime acceptance blocked",
    "functionalBlockers": 0,
    "environmentBlockers": 1,
    "independentBrowser": "Browser walk-through unavailable: ports 5173 and 5174 were occupied; Playwright and Chrome DevTools profiles were already in use; Computer Use stopped because it could not identify the active Chrome URL safely.",
    "requirements": [
      {
        "area": "Event sources, explicit order, missing and empty folders, final Planetarium placement",
        "verdict": "partial"
      },
      {
        "area": "Alternating wall sides and route placement",
        "verdict": "partial"
      },
      {
        "area": "Main photo visibility, numbered and stable fallback slots, focused extra-photo reveal, missing-image handling",
        "verdict": "partial"
      },
      {
        "area": "Collage clearance from the passage",
        "verdict": "partial"
      },
      {
        "area": "JSON captions, stable IDs, empty captions, display and refresh",
        "verdict": "partial"
      },
      {
        "area": "Camera movement and Planetarium-to-galaxy transition",
        "verdict": "partial"
      }
    ],
    "commands": [
      {
        "command": "npm run dev",
        "result": "exit 1: port 5173 is already in use"
      },
      {
        "command": "npm run dev -- --port 5174",
        "result": "exit 1: port 5174 is already in use"
      },
      {
        "command": "npm run check",
        "result": "exit 0: lint, typecheck, build passed; 488 tests in 97 files passed"
      }
    ]
  }
};
