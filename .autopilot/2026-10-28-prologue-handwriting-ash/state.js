window.STATE =
{
  "slug": "prologue-handwriting-ash",
  "dir": "2026-10-28-prologue-handwriting-ash",
  "title": "Пролог 01.2–01.4 — рукописный текст и частицы",
  "mode": "full",
  "depth": "normal",
  "polish": null,
  "tier": "T2",
  "briefFile": "2026-10-28-brief.md",
  "memoryFile": "AGENTS.md",
  "skillDir": "C:/Users/McHomak/.agents/skills/autopilot",
  "startedAt": "2026-10-28T00:30:25+03:00",
  "updatedAt": "2026-10-28T05:36:29+03:00",
  "finishedAt": "2026-10-28T05:36:29+03:00",
  "stages": [
    {
      "id": "preflight",
      "status": "done",
      "startedAt": "2026-10-28T00:30:25+03:00",
      "finishedAt": "2026-10-28T00:32:03+03:00"
    },
    {
      "id": "manifest",
      "status": "done",
      "startedAt": "2026-10-28T00:32:03+03:00",
      "finishedAt": "2026-10-28T00:35:26+03:00"
    },
    {
      "id": "briefing",
      "status": "skipped",
      "note": "Полный режим: самостоятельная спецификация, дозапросы не понадобились."
    },
    {
      "id": "spec",
      "status": "done",
      "startedAt": "2026-10-28T00:35:26+03:00",
      "finishedAt": "2026-10-28T00:44:55+03:00"
    },
    {
      "id": "plan",
      "status": "done",
      "startedAt": "2026-10-28T00:44:55+03:00",
      "finishedAt": "2026-10-28T00:47:47+03:00",
      "note": "4 исходных таска, 3 волны; G3 пройден."
    },
    {
      "id": "build",
      "status": "done",
      "startedAt": "2026-10-28T05:13:15+03:00",
      "note": "5 из 5 тасков завершены; 99 тестов, lint, typecheck и production build прошли.",
      "finishedAt": "2026-10-28T05:21:48+03:00"
    },
    {
      "id": "review",
      "status": "done",
      "startedAt": "2026-10-28T05:13:15+03:00",
      "note": "5 из 5 тасков завершены; 99 тестов, lint, typecheck и production build прошли.",
      "finishedAt": "2026-10-28T05:21:48+03:00"
    },
    {
      "id": "final",
      "status": "done",
      "startedAt": "2026-10-28T05:21:48+03:00",
      "finishedAt": "2026-10-28T05:36:29+03:00",
      "note": "Проверка завершена; Vite перезапущен, страница обновлена для просмотра."
    }
  ],
  "requirements": {
    "total": 44,
    "done": 44,
    "inTicket": 0,
    "inSpec": 0,
    "placeholder": 0,
    "deferred": 0,
    "dropped": 0
  },
  "tickets": [
    {
      "id": "01",
      "title": "Настройки пролога в Scene Composer",
      "requirements": [
        "R22",
        "R23",
        "R24",
        "R25",
        "R26",
        "R27",
        "R28",
        "R29",
        "R30",
        "R31",
        "R32",
        "R36",
        "R37"
      ],
      "blockedBy": [],
      "wave": 1,
      "zone": [
        "frontend/src/systems/scene-config/",
        "frontend/src/debug/",
        "frontend/src/systems/scene-config/README.md"
      ],
      "status": "done",
      "startedAt": "2026-10-28T00:47:47+03:00",
      "finishedAt": "2026-10-28T00:56:06+03:00",
      "retries": 0,
      "repairs": 1,
      "repairFindings": [
        "npm run check: existing prologue test expected particleTravelDuration 4, received 2.4; preserve travel timing and separate ash fade duration."
      ],
      "handoffs": 0,
      "files": [
        "frontend/src/systems/scene-config/config.ts",
        "frontend/src/systems/scene-config/config.test.ts",
        "frontend/src/systems/scene-config/README.md",
        "frontend/src/debug/composerControls.ts",
        "frontend/src/debug/composerControls.test.ts",
        "frontend/src/debug/DeveloperPanel.tsx",
        "frontend/src/debug/DeveloperPanel.test.ts"
      ],
      "tests": {
        "passed": 86,
        "failed": 0,
        "files": 23,
        "command": "npm run check"
      },
      "commit": null,
      "concerns": [
        "Craft: legacy renderer aliases remain in schema v2; remove once PrologueScene migrates to v2 settings (ticket 03)."
      ]
    },
    {
      "id": "02",
      "title": "Плавное письмо и пауза разрушения",
      "requirements": [
        "R01",
        "R02",
        "R03",
        "R09",
        "R10",
        "R11",
        "R12",
        "R13",
        "R14",
        "R33",
        "R34"
      ],
      "blockedBy": [
        "01"
      ],
      "wave": 2,
      "zone": [
        "frontend/src/components/PrologueOverlay.tsx",
        "frontend/src/components/prologue.css",
        "frontend/src/engine/filmConfig.ts",
        "frontend/src/components/PrologueOverlay.test.ts",
        "frontend/src/engine/filmConfig.test.ts"
      ],
      "status": "done",
      "startedAt": "2026-10-28T00:56:26+03:00",
      "finishedAt": "2026-10-28T01:07:01+03:00",
      "retries": 0,
      "repairs": 0,
      "repairFindings": [],
      "handoffs": 0,
      "files": [
        "frontend/src/components/PrologueOverlay.tsx",
        "frontend/src/components/prologue.css",
        "frontend/src/components/PrologueOverlay.test.ts"
      ],
      "tests": {
        "focused": 7,
        "full": 95,
        "failed": 0,
        "files": 24,
        "command": "npm run check"
      },
      "commit": null,
      "concerns": []
    },
    {
      "id": "03",
      "title": "GPU-пепел из пикселей шрифта",
      "requirements": [
        "R04",
        "R05",
        "R06",
        "R07",
        "R08",
        "R13",
        "R14",
        "R15",
        "R16",
        "R17",
        "R18",
        "R19",
        "R20",
        "R21",
        "R22",
        "R28",
        "R29",
        "R30",
        "R31",
        "R32",
        "R42",
        "R43",
        "R44"
      ],
      "blockedBy": [
        "01"
      ],
      "wave": 2,
      "zone": [
        "frontend/src/scenes/PrologueScene.tsx",
        "frontend/src/scenes/prologue/"
      ],
      "status": "done",
      "startedAt": "2026-10-28T00:56:26+03:00",
      "finishedAt": "2026-10-28T05:00:21+03:00",
      "retries": 0,
      "repairs": 1,
      "repairFindings": [
        "Blocking M+S: shader caps particle life at particleFadeDuration 2.4s; preserve the separate 4s particleDuration travel and gradual 2.4s fade."
      ],
      "handoffs": 1,
      "files": [
        "frontend/src/scenes/PrologueScene.tsx",
        "frontend/src/scenes/prologue/particleMath.ts",
        "frontend/src/scenes/prologue/particleMath.test.ts",
        "frontend/src/systems/scene-config/config.ts",
        "frontend/src/systems/scene-config/config.test.ts",
        ".autopilot/2026-10-28-prologue-handwriting-ash/handoff-03-1.md"
      ],
      "tests": {
        "focused": 8,
        "full": 97,
        "failed": 0,
        "files": 24,
        "command": "npm run check"
      },
      "commit": null,
      "concerns": [
        "Build warnings: Three.js CJS deprecation and >500kB chunk.",
        "Physical tablet/Safari unverified."
      ]
    },
    {
      "id": "04",
      "title": "Сценарий, документация и проверка",
      "requirements": [
        "R34",
        "R35",
        "R36",
        "R37",
        "R38",
        "R39",
        "R40",
        "R41",
        "R42",
        "R43",
        "R44"
      ],
      "blockedBy": [
        "02",
        "03"
      ],
      "wave": 3,
      "zone": [
        "A_Little_Universe_for_Vasilisa_Storyboard_v2.0.md",
        "docs/architecture.md",
        "docs/verification.md"
      ],
      "status": "done",
      "startedAt": "2026-10-28T05:00:21+03:00",
      "finishedAt": "2026-10-28T05:12:03+03:00",
      "retries": 0,
      "repairs": 1,
      "repairFindings": [
        "Manifest+Spec: documentation must state that the four-frame collage is an art-direction reference and not a runtime image.",
        "Manifest+Spec: record the actual timed visual observation at 16.8s or remove an unsupported visual-check claim."
      ],
      "handoffs": 0,
      "files": [
        "A_Little_Universe_for_Vasilisa_Storyboard_v2.0.md",
        "docs/architecture.md",
        "docs/verification.md"
      ],
      "tests": {
        "passed": 97,
        "failed": 0,
        "files": 24,
        "command": "npm run check"
      },
      "commit": null,
      "concerns": [
        "Physical tablet/Safari unverified."
      ]
    },
    {
      "id": "05",
      "title": "Wrapped-text mask and low-count particle safety",
      "requirements": [
        "R15",
        "R19",
        "R28",
        "R30"
      ],
      "blockedBy": [
        "03",
        "04"
      ],
      "wave": 4,
      "zone": [
        "frontend/src/scenes/PrologueScene.tsx",
        "frontend/src/scenes/prologue/particleMath.ts",
        "frontend/src/scenes/prologue/particleMath.test.ts",
        "docs/architecture.md",
        "docs/verification.md"
      ],
      "status": "done",
      "startedAt": "2026-10-28T05:13:15+03:00",
      "finishedAt": "2026-10-28T05:21:48+03:00",
      "retries": 0,
      "repairs": 0,
      "repairFindings": [],
      "handoffs": 0,
      "files": [
        "frontend/src/scenes/PrologueScene.tsx",
        "frontend/src/scenes/prologue/particleMath.ts",
        "frontend/src/scenes/prologue/particleMath.test.ts",
        "docs/architecture.md",
        "docs/verification.md"
      ],
      "tests": {
        "focused": 11,
        "full": 99,
        "failed": 0,
        "files": 24,
        "command": "npm run check"
      },
      "commit": null,
      "concerns": [
        "Physical iPad/Safari unverified.",
        "Existing Three.js and bundle-size advisories remain."
      ]
    }
  ],
  "singlePass": null,
  "tests": {
    "passed": 99,
    "failed": 0,
    "files": 24,
    "command": "npm run check"
  },
  "debt": {
    "placeholders": [],
    "assumptions": [
      "A01: Сохраняются существующие строки storyboard/COPY; меняются только оформление и анимация.",
      "A02: Marck Script остаётся стандартным шрифтом; Composer font picker сохраняет совместимость.",
      "A03: Частицы летят вверх-влево вместо прежнего возврата к центру.",
      "A04: Сохраняются порядок кадров, timing windows, 21-секундный gate и текущий touch gate.",
      "A05: Composer schema повышена до v2 с чтением старых JSON и безопасными defaults.",
      "A06: Подсказка получает отдельную короткую настраиваемую длительность письма.",
      "A07: Начальные параметры: wind 1.15, turbulence 0.3, fracture width 0.08, fracture 2.6s, fade 2.4s, glow 0.45, count 1800.",
      "A08: Один крупный фрагмент делится на несколько мелких GPU-пылинок; точное число не выводится в отдельный контрол."
    ],
    "emptyEnv": []
  },
  "additions": [],
  "coverage": {
    "gate": "G2",
    "status": "passed",
    "independentPasses": 4,
    "final": {
      "missing": 0,
      "halfCovered": 0,
      "outOfBrief": 0
    },
    "found": 10,
    "fixed": 10,
    "deferred": 0,
    "findings": [
      {
        "pass": 1,
        "type": "missing",
        "items": "reference file/four states, white text on near-black, project module study, next-scene transition",
        "action": "Added exact reference and frame description, appearance constraints, existing module boundaries, and transition preservation."
      },
      {
        "pass": 2,
        "type": "partial/out-of-brief",
        "items": "touch prompt wording, timing/color specifics, implementation details",
        "action": "Kept existing prompt copy; removed unrequested exact color and frame times from the public behavior summary; mapped implementation defaults and migration choices to parent Composer/pixel-mask requirements."
      },
      {
        "pass": 3,
        "type": "out-of-brief",
        "items": "font picker remains compatible",
        "action": "Tied this compatibility behavior to R15: standard mask is Marck Script; existing picker remains aligned with rendered glyphs."
      },
      {
        "pass": 4,
        "type": "clean",
        "items": "",
        "action": "No missing, half-covered, or unparented decisions."
      }
    ]
  },
  "concerns": [
    "Physical iPad/Safari remain unverified; browser QA used desktop Chrome viewport emulation.",
    "npm run check passes with a THREE.Clock deprecation warning and an advisory for an App bundle chunk larger than 500kB.",
    "Dropped in triage: dashboard.html was blocked by the browser file:// policy; the film itself runs on the local HTTP server and was inspected."
  ],
  "reviewers": {
    "manifestSpec": "/root/g2_spec_coverage",
    "craft": "/root/craft_review"
  },
  "blind": {
    "matched": 35,
    "checked": 44,
    "mismatches": [
      "R02/R03/R11 — используется плавная мягкая маска слева направо; независимая проверка отметила, что она не трассирует каждый штрих шрифта.",
      "R19 — DOM-текст расположен поверх GPU-частиц, но независимый проверяющий не смог наблюдать фактическое перекрытие в браузере.",
      "R04/R05/R42–R44 — по коду заданы белый пепел и движение по референсу; визуально сравнить кадры проверяющий не смог из-за занятого профиля браузера.",
      "R41 — проверяющий подключился к уже работающему HTTP-серверу, но не перезапустил его; после проверки root перезапустил сервер и заново открыл страницу."
    ]
  }
}
