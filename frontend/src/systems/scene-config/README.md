# Scene Composer configuration

`SceneComposerConfig` is an immutable schema version 16. `normalizeConfig(input)` accepts partial schema v1–v16 JSON; unknown keys are discarded and missing or invalid values use current defaults. Schema v3 galaxy `spin` values are migrated from turns to radians; schema v4 and later store winding in radians. Schema v9's old `cloudLayerCount: 12` default migrates to 18, while intentionally lower counts (including zero) are preserved; schema v10 and later retain an explicit count of 12. Schema v11 contains the current gallery and identity controls. Schema v12 adds the first bounded island controls, while schema v13 adds island thickness, lower depth, edge roughness, grass height, and wind strength. Schema v14 adds independently configurable moon light, beam, color, and source position for Scene 02. Schema v15 adds seed staging, impact, scattering, and Scene 02 cloud controls; older configs receive defaults. Schema v16 adds smoothed camera-follow speed, seed spin speed, and seed wobble amplitude. Its default fall duration is 3.6 s; explicit schema v15 durations remain unchanged during migration. `islandRevealDuration` remains accepted for schema compatibility but is no longer exposed in the editor or used to fade the island. Legacy Scene 02 moon X/Z positions remain normalized for compatibility, while the Scene 02 editor exposes only source Y. The store publishes font changes only after the selected local font is ready.

The public store is:

- `normalizeConfig(input: unknown): SceneComposerConfig`
- `loadStartupConfig(): Promise<void>`
- `getConfig(): SceneComposerConfig`
- `subscribeConfig(listener: (config: SceneComposerConfig) => void): () => void`
- `updateConfig(patch: SceneComposerConfigPatch): Promise<SceneComposerConfig>`
- `resetConfig(scope: ConfigResetScope): Promise<SceneComposerConfig>`

`loadStartupConfig` fetches `${BASE_URL}scene-composer.json` after preload; failure or malformed JSON leaves the active snapshot unchanged. Composer import and export use the same normalizer and store. Exported JSON uses schema v17. Upgrading v16 migrates untouched Scene 02 defaults (`seedFallDuration: 3.6`, `cloudCount: 3`) to the new defaults while preserving other explicit user values.

Schema v1 migration preserves the other recognized scene and global settings. Legacy `particleSpeed` maps to `windStrength` using `clamp(particleSpeed × 1.15, 0.2, 3)`, and `particleSpread` maps to `turbulence` using `particleSpread × 0.3`. Legacy particle counts below the v2 minimum are raised to 300. `particleDuration` keeps its 0.1–20 second travel-window meaning, with the cinematic default now 2.2 seconds; `particleFadeDuration` controls individual dust fade and defaults to 1.2 seconds. `particleReturnFraction` is ignored. The light, atmosphere, typography and interaction fields are additive schema-v2 fields: missing fields in both v1 and v2 files receive current defaults.

An optional production override can contain only values that differ from the defaults:

```json
{
  "schemaVersion": 16,
  "global": { "quality": "low" },
  "scenes": {
    "preparation": {
      "typeScale": 1.05,
      "lineHeight": 1.2,
      "cardOpacity": 0.9
    },
    "prologue": {
      "fontFamily": "marck-script",
      "particleCount": 2100,
      "windStrength": 1.4,
      "turbulence": 0.35,
      "fractureWidth": 0.08,
      "fractureDuration": 1.5,
      "particleDuration": 2.2,
      "particleFadeDuration": 1.2,
      "promptHandwritingDuration": 0.65,
      "glow": 0.45
    },
    "galaxy": {
      "seed": "andromeda",
      "starCount": 34000,
      "arms": 4,
      "quality": "standard",
      "palette": "vasilisa",
      "rotationSpeed": 0.006
    }
  }
}
```

## Normalization ranges

| Section | Field | Accepted range / default |
|---|---|---:|
| Global | DPR min / max | 0.5–1.5 / 1–2, with min ≤ max |
| Global | Playback speed | 0.25–4 |
| Preload | Glow, particle count, movement speed, collapse duration | 0–2, 40–300 integer, 0.1–4, 0–4 |
| Preparation | Spacing, entrance duration | 0–64, 0–5 |
| Preparation | Heading scale, line height, card opacity | 0.9–1.1, 0.9–1.5, 0.85–1 |
| Gallery light | Moon light color/intensity; halo intensity/radius | `#C3D8F2`; 0–3; 0–2; 0–2.5 |
| Gallery light | Scattering / godray intensity | 0–1.5; 0–0.8 |
| Gallery light | Moon position X / Y / Z | −12–12 / 4–24 / −180–−80 world units |
| Gallery light | Light target X / Y / Z | −40–40 / −12–14 / −180–40 world units |
| Prologue | Font size, line height, position Y | 16–160, 0.8–2.5, 10–80 |
| Prologue | Handwriting duration/rhythm, phrase interval, readable hold | 0.5–20, 0.1–3, 0–8, 0–30 |
| Prologue | Particle count | 300–6000 integer; default 1800 |
| Prologue | Wind strength, turbulence | 0.2–3 (default 1.15), 0–1 (default 0.3) |
| Prologue | Fracture width / spatial variation | 0–0.18; default 0.08 |
| Prologue | Fracture and dust fade duration | 0.8–4 s (default 1.5), 0.5–4 s (default 1.2) |
| Prologue | Particle travel-window duration | 0.1–20 s; default 2.2 |
| Prologue | Prompt handwriting duration | 0.2–0.8 s; default 0.65 |
| Prologue | Glow, pulse amplitude/frequency, seed | 0–2 (default 0.45), 0–1, 0–5, integer 0–2147483647 |
| Light | Core intensity; inner / outer glow radius | 0.2–2 (default 1); 6–40 / 40–160 CSS px (16 / 95) |
| Light | Phrase response | 0–0.6; default 0.12 |
| Atmosphere | Density; haze; space depth; drift speed | 0–120 integer (42); 0–0.12 (0.035); 0–1 (0.35); 0–0.2 (0.035) |
| Typography | Second font scale; text gap; text glow | 0.6–1.2 (0.86); 20–100 CSS px (34); 0–1 (0.22) |
| Typography | Copy variant | `legacy` (default) or `awakening` |
| Dissolve | Particle size min / max; particle glow | 0.25–2.5 / 0.5–4 CSS px (0.6 / 1.8), min ≤ max; 0–2 (0.95) |
| Interaction | Touch intensity / duration | 0–1.5 (0.55) / 0.7–1 s (0.85) |
| Interaction | Wave strength / radius | 0–0.5 (0.14) / 30–120 CSS px (70) |
| Scene 02 island | Radius / grass blades / wind speed | 0.55–1.05 (0.82) / 80–720 integer (360) / 0–2.5 (0.8) |
| Scene 02 moonlight | Direct light intensity / color | 0–2 (1.2) / `#AFC9F5` |
| Scene 02 moon beam | Diameter / island-radius ratio / softness / volumetric intensity | 0.4–4 (2× island radius) / 0.05–1 (0.6) / 0–1.5 (0.55) |
| Scene 02 moon source | Y position control; legacy X/Z values retained | 1–10 (5.5); X/Z each −4–4 (−0.65 / 1) |
| Scene 02 seed orbit | Count / radius / tilt / speed | 1–5 integer (3) / 0.24–0.62 m (0.4) / 0.15–1.2 rad (0.62) / 0–2 (0.85) |
| Scene 02 seed fall | Duration / camera lag / follow speed | 1.8–4.5 s (3.6) / 0.1–0.8 s (0.3) / 0.1–8 s⁻¹ (3; higher follows faster) |
| Scene 02 seed motion | Spin speed / wobble tilt amplitude | 0–4 rad/s (1) / 0–0.35 rad (0.08) |
| Scene 02 island reveal | Legacy `islandRevealDuration` | 0.4–3 s (1.5; retained for compatibility, no longer exposed or used to fade the island) |
| Scene 02 seed trail and impact | Trail / strength / radius / particles / lifetime | 0–2 (1) / 0–1 (0.6) / 0.1–1.2 m (0.72) / 0–180 integer (64) / 0.2–1.6 s (0.85) |
| Scene 02 moon scattering | Intensity | 0–1.5 (0.35) |
| Scene 02 clouds | Count / density / scale / drift / opacity / light | 0–6 integer (3) / 0–2 (0.8) / 0.4–2 (1) / 0–2 (0.3) / 0–1 (0.42) / 0–2 (0.7) |
| Galaxy Geometry | Star count, arms, radius, spin | 8000–90000 integer (32000), 2–8 integer (5), 4–14 (8.2), 0.2–18 (4.6 radians) |
| Galaxy Geometry | Seed | String, 1–64 characters (default `andromeda`) |
| Galaxy Geometry | Arm width / randomness / randomness power | 0–0.5 (0.16) / 0–0.3 (0.065) / 0.1–8 (3.6) |
| Galaxy Geometry | Core size / core density / thickness | 0.08–0.5 (0.24) / 0–0.5 (0.2) / 0.005–0.2 (0.05) |
| Galaxy Quality | Local profile / distribution | `low` / `standard` / `high` (default `standard`); `balanced` / `core` / `arms` (default `balanced`) |
| Galaxy Stars | Size, brightness, twinkle | 0.25–3.5 (1.03), 0.1–1.5 (1.14), 0–1 (0.5) |
| Galaxy Background | Star count / gas density / gas brightness | 0–10000 (5200) / 0–0.8 (0.34) / 0–1 (0.34) |
| Galaxy Nebula | Density / brightness / saturation | 0–1 (0.5) / 0–1.5 (0.69) / 0–1.5 (1.15) |
| Galaxy Nebula | Opacity / scale / intensity / speed | 0–1 (0.72) / 0.3–4 (1.35) / 0–2 (0.46) / 0–0.1 (0.018) |
| Galaxy Reveal Fog | Density / layers / depth / dissipation | 0–1 (0.14) / 1–8 (3) / 4–30 (14) / 0–1 (0.84) |
| Galaxy Reveal Fog | Start / end / turbulence / residual opacity | 0–8 s (1.5) / 4–18 s (8.5) / 0–1 (0.18) / 0–0.2 (0.008) |
| Galaxy Motion | Rotation / overall speed | 0–0.1 (0.045) / 0–2 (1) |
| Galaxy Motion | Reveal / idle rate; first stars / reveal start | 0–3 (1) / 0–0.6 (0.3); 0–6 s (0.25) / 0–10 s (1.2) |
| Galaxy Motion | Reveal / pause / background transition | 5–18 s (10.4) / 0–12 s (4.2) / 2–18 s (7) |
| Galaxy Camera | Start/end distance, angle, duration | 3–12 (6.4) / 9–28 (16); −0.3–0.8 (0.18) / 0.1–0.95 (0.785) rad; 5–18 s (10) |

Default breathing uses amplitude `0.035` and frequency `0.22` Hz (about 4.5 seconds). The canonical prologue gate remains fixed at 18 seconds; configured reveal/hold/fracture windows are fitted inside it, with the dust gone by the invitation at 16 seconds. Touch duration is captured at activation, so editing it during a transition does not change that transition. The default uses the approved second phrase; `copyVariant: "awakening"` remains available as an explicit alternate wording.

The existing `Moonlit Letter` and `Stardust` presets remain available; `Vasilisa Cinematic` presets Scene 07's palette, star density and lighting. The galaxy section stores seeded geometry, live shader values, background and foreground gas, reveal timing, camera staging, and an independent custom palette. Geometry controls rebuild after a 280 ms quiet interval; shader uniforms update live. Geometry and materials are disposed when replaced or unmounted. Scene 07, 08, and 09 share one persistent scene graph and one renderer. The ending uses the shared FilmClock presentation channel for slow motion while its film state remains ended. Global quality, DPR and playback settings remain global and are not changed by prologue-specific controls. The store owns neither a playback clock nor a canvas.

The preparation defaults keep the existing composition: heading scale `1`, heading line height `1.08`, and card surface opacity `1`. These settings use `--preparation-type-scale`, `--preparation-line-height`, and `--preparation-card-opacity`; reset restores the defaults.

The only accepted art font IDs are `great-vibes`, `marck-script`, `bad-script`, `caveat`, and `cormorant-garamond`. They are declared in `fontIds.ts`; `fontCatalog.ts` defines the corresponding local CSS family, readiness call, and checked Russian glyph set. Font files use SIL Open Font License 1.1; see `src/assets/typography/` for license texts and attribution.
