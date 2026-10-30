# ADR 0013 — Shared procedural galaxy and license boundary

Date: 2026-10-30

Status: Accepted for Scene 07 integration

## Context

Scenes 07–09 need one galaxy that survives scene-module changes, runs through the existing WebGL renderer and film clock, and can be tuned from the Scene Composer. The supplied public procedural-galaxy repository has no license file. Public visibility alone does not grant permission to copy or adapt its source.

## Decision

Implement the scene independently from broad visual concepts: deterministic seeded spiral placement, custom GPU point shaders, procedural gas, background stars and depth-layered reveal fog. Keep the persistent galaxy component outside SceneDirector's keyed scene subtree. Rebuild structural geometry after a 280 ms quiet interval; update shader settings live. Scene 09 keeps mode `ended` but uses the existing FilmClock's `presentationTime` to drive quiet ambience without dispatching film actions or adding an animation loop.

Palette labels are independent artistic interpretations. They are not represented as exact reproductions of source palette values. The system omits exploration markers, codex, HUD, navigation, stars-to-planets interactions, original controls, audio, and source project's renderer/postprocessing.

## Consequences

The geometry and shaders do not reproduce the reference's exact generation mathematics. The gas remains shader-based and separates disk gas, background gas and reveal fog, but does not ray-march a volumetric cloud. Visual comparison with the source demo and measurement on a physical iPad remain required before claiming comparable appearance or target-device performance.
