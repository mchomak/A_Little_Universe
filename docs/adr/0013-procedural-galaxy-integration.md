# ADR 0013 — Shared procedural galaxy adaptation and license boundary

Date: 2026-10-30

Status: Accepted for Scene 07 integration

## Context

Scenes 07–09 need one galaxy that survives scene-module changes, runs through the existing WebGL renderer and film clock, and can be tuned from the Scene Composer. The supplied public procedural-galaxy repository has no license file. Public visibility alone does not grant permission to copy or adapt its source.

## Decision

Adapt the supplied repository's implementation into the existing film architecture. The port retains the cited source's deterministic galaxy distribution, RNG, star and gas shader techniques, cloud sprite approach, and palette values, with changes documented in `docs/scene-07-galaxy.md`. Keep the persistent galaxy component outside SceneDirector's keyed scene subtree. Rebuild structural geometry after a 280 ms quiet interval; update shader settings live. Scene 09 keeps mode `ended` but uses the existing FilmClock's `presentationTime` to drive quiet ambience without dispatching film actions or adding an animation loop.

The supplied repository has no license file, so rights-holder permission for this adaptation has not been verified. The port omits exploration markers, codex, HUD, navigation, stars-to-planets interactions, original controls, audio, and the source project's renderer/postprocessing. Its LDR rendering path approximates the reference's HDR output and is not numerically identical.

## Consequences

The integration is an adaptation of the cited source, and its reuse permission remains unverified. The gas separates disk gas, background gas and reveal fog with layered shaders, but does not ray-march a volumetric cloud. The LDR output differs from the source HDR pipeline. Physical iPad/Safari comparison and performance remain unverified.
