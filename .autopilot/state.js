window.STATE =
{
  "slug": "scene-04-05-gallery-reveal",
  "dir": "2026-11-06-scene-04-05-gallery-reveal--wip",
  "title": "Плавный переход сцены 04→05",
  "mode": "full",
  "depth": "normal",
  "polish": null,
  "tier": "T2",
  "briefFile": "2026-11-06-brief.md",
  "memoryFile": "AGENTS.md",
  "skillDir": "C:/Users/McHomak/.agents/skills/autopilot",
  "startedAt": "2026-11-06T08:05:53+03:00",
  "updatedAt": "2026-11-06T09:27:25+03:00",
  "finishedAt": null,
  "stages": [
    { "id": "preflight", "status": "done", "startedAt": "2026-11-06T08:05:53+03:00", "finishedAt": "2026-11-06T08:09:16+03:00" },
    { "id": "manifest", "status": "done", "startedAt": "2026-11-06T08:09:16+03:00", "finishedAt": "2026-11-06T08:18:36+03:00" },
    { "id": "briefing", "status": "skipped", "startedAt": "2026-11-06T08:18:36+03:00", "finishedAt": "2026-11-06T08:18:36+03:00", "note": "Полный автомат: вопросы не требуются; порядок и ограничения зафиксированы в самобрифинге." },
    { "id": "spec", "status": "done", "startedAt": "2026-11-06T08:18:36+03:00", "finishedAt": "2026-11-06T08:50:00+03:00" },
    { "id": "plan", "status": "done", "startedAt": "2026-11-06T08:34:58+03:00", "finishedAt": "2026-11-06T08:52:40+03:00", "note": "5 тасков, ярус T2, 3 волны" },
    { "id": "build", "status": "active", "startedAt": "2026-11-06T08:52:40+03:00", "note": "таск 02 проверен; 03 и 04 в работе" },
    { "id": "review", "status": "active", "startedAt": "2026-11-06T09:10:17+03:00", "note": "T02 Manifest/Spec clean; полный suite 841/841 green" },
    { "id": "final", "status": "pending" }
  ],
  "requirements": {
    "total": 22, "done": 10, "inTicket": 11, "inSpec": 0,
    "placeholder": 0, "deferred": 1, "dropped": 0
  },
  "tickets": [
    { "id": "01", "title": "Временная модель входа в галерею", "requirements": ["R09", "R10", "R12", "R13", "R14", "R16", "R18"], "blockedBy": [], "wave": 1, "zone": ["frontend/src/scenes/gallery/controller.ts", "frontend/src/scenes/gallery/entryReveal.ts", "frontend/src/engine/galleryCameraPose.ts"], "status": "done", "startedAt": "2026-11-06T08:54:12+03:00", "finishedAt": "2026-11-06T09:17:45+03:00", "retries": 0, "repairs": 0, "handoffs": 0, "files": ["frontend/src/scenes/gallery/entryReveal.ts", "frontend/src/scenes/gallery/entryReveal.test.ts", "frontend/src/scenes/gallery/controller.ts", "frontend/src/scenes/gallery/controller.test.ts", "frontend/src/engine/galleryCameraPose.ts", "frontend/src/engine/galleryCameraPose.test.ts"], "tests": { "passed": 142, "failed": 0, "files": 142 }, "commit": "3cd7e65", "concerns": ["craft · entryReveal.test.ts:33 — assert full support set and nearest-support photo mappings"] },
    { "id": "02", "title": "Первой проявляется вода", "requirements": ["R13", "R14", "R15"], "blockedBy": ["01"], "wave": 2, "zone": ["frontend/src/scenes/gallery/WetFloor.tsx", "frontend/src/scenes/gallery/waterMaterial.ts"], "status": "review", "startedAt": "2026-11-06T09:18:50+03:00", "retries": 0, "repairs": 0, "handoffs": 0 },
    { "id": "03", "title": "Облака, ночь и лунный свет", "requirements": ["R13", "R14", "R15"], "blockedBy": ["01"], "wave": 2, "zone": ["frontend/src/scenes/gallery/MoonlitWorld.tsx", "frontend/src/scenes/gallery/cloudMaterial.ts"], "status": "in-progress", "startedAt": "2026-11-06T09:18:50+03:00", "retries": 0, "repairs": 0, "handoffs": 0 },
    { "id": "04", "title": "Фотографии и колонны от ближних к дальним", "requirements": ["R14", "R15", "R16", "R17"], "blockedBy": ["01"], "wave": 2, "zone": ["frontend/src/scenes/GalleryScene.tsx", "frontend/src/scenes/gallery/GalleryColumn.tsx", "frontend/src/scenes/gallery/visibility.ts"], "status": "in-progress", "startedAt": "2026-11-06T09:18:50+03:00", "retries": 0, "repairs": 0, "handoffs": 0 },
    { "id": "05", "title": "Арка завершает раскрытие", "requirements": ["R09", "R14", "R15", "R18", "R19", "R20", "R21", "R22"], "blockedBy": ["02", "03", "04"], "wave": 3, "zone": ["frontend/src/scenes/gallery/GalleryArch.tsx", "frontend/src/scenes/gallery/visibility.ts"], "status": "pending", "retries": 0, "repairs": 0, "handoffs": 0 }
  ],
  "singlePass": null,
  "tests": { "passed": 841, "failed": 0, "files": 142 },
  "debt": { "placeholders": [], "assumptions": [], "emptyEnv": [] },
  "additions": [],
  "coverage": {
    "result": "passed",
    "findings": 12,
    "actions": [
      "Первый слепой проход выявил несогласованность порядка и отсутствующие acceptance для поведения памятки и публикации; уточнено до реализации.",
      "Последующие слепые сверки выявили неоднозначность пар колонн, лишний полный project check и отсутствие явного сохранения штатных alpha-модификаторов; всё приведено в соответствие с брифом и фактическим поведением.",
      "Финальные крайние случаи: арка должна ждать фото без опоры; критерий и тест это явно проверяют."
    ]
  },
  "concerns": ["T01 craft · entryReveal.test.ts:33 — strengthen assertions for the full support set and nearest-support photo mappings; non-blocking, review at final"],
  "reviewers": { "manifestSpec": "/root/spec_coverage_audit", "craft": null },
  "blind": null
}
