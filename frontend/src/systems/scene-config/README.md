# Scene Composer configuration

`SceneComposerConfig` is an immutable schema version 4. `normalizeConfig(input)` accepts partial schema v4 and older schema v1/v2/v3 JSON; unknown keys are discarded and missing or invalid values use the v4 defaults. Schema v3 galaxy `spin` values are migrated from turns to radians; schema v4 stores total winding in radians. The store publishes font changes only after the selected local font is ready.

The public store is:

- `normalizeConfig(input: unknown): SceneComposerConfig`
- `loadStartupConfig(): Promise<void>`
- `getConfig(): SceneComposerConfig`
- `subscribeConfig(listener: (config: SceneComposerConfig) => void): () => void`
- `updateConfig(patch: SceneComposerConfigPatch): Promise<SceneComposerConfig>`
- `resetConfig(scope: ConfigResetScope): Promise<SceneComposerConfig>`

`loadStartupConfig` fetches `${BASE_URL}scene-composer.json` after preload; failure or malformed JSON leaves the active snapshot unchanged. Composer import and export use the same normalizer and store. Exported JSON uses schema v4.

Schema v1 migration preserves the other recognized scene and global settings. Legacy `particleSpeed` maps to `windStrength` using `clamp(particleSpeed × 1.15, 0.2, 3)`, and `particleSpread` maps to `turbulence` using `particleSpread × 0.3`. Legacy particle counts below the v2 minimum are raised to 300. `particleDuration` keeps its 0.1–20 second travel-window meaning, with the cinematic default now 2.2 seconds; `particleFadeDuration` controls individual dust fade and defaults to 1.2 seconds. `particleReturnFraction` is ignored. The light, atmosphere, typography and interaction fields are additive schema-v2 fields: missing fields in both v1 and v2 files receive current defaults.

An optional production override can contain only values that differ from the defaults:

```json
{
  "schemaVersion": 3,
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
      "seed": 731204,
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
| Typography | Copy variant | `awakening` (default) or `legacy` |
| Dissolve | Particle size min / max; particle glow | 0.25–2.5 / 0.5–4 CSS px (0.6 / 1.8), min ≤ max; 0–2 (0.95) |
| Interaction | Touch intensity / duration | 0–1.5 (0.55) / 0.7–1 s (0.85) |
| Interaction | Wave strength / radius | 0–0.5 (0.14) / 30–120 CSS px (70) |
| Galaxy Geometry | Star count, arms, radius | 8000–90000 integer (34000), 2–8 integer (4), 4–14 (8.2) |
| Galaxy Geometry | Seed, arm width, scatter, thickness | integer 0–2147483647; 0.12–1.1; 0–1; 0.08–1.6 |
| Galaxy Quality | Local profile / distribution | `low` / `standard` / `high`; `balanced` / `core` / `arms` |
| Galaxy Stars | Size, brightness, twinkle | 0.25–3.5 (1.25), 0.1–1.5 (0.68), 0–1 |
| Galaxy Background | Star count / gas density / gas brightness | 0–6000 / 0–0.8 / 0–1 |
| Galaxy Nebula | Density, opacity, scale, speed | 0–1; 0–1; 0.3–4; 0–0.1 |
| Galaxy Reveal Fog | Layers, depth, dissipation | 1–8; 4–30; 0–1 |
| Galaxy Motion | Rotation, reveal/idle rates, reveal duration | 0–0.04; 0–3 / 0–0.6; 5–18 s |
| Galaxy Camera | Start/end distance, angle, duration | 3–12 / 9–28; −0.3–0.8 / 0.1–0.95 rad; 5–18 s |

Default breathing uses amplitude `0.035` and frequency `0.22` Hz (about 4.5 seconds). The canonical prologue gate remains fixed at 18 seconds; configured reveal/hold/fracture windows are fitted inside it, with the dust gone by the invitation at 16 seconds. Touch duration is captured at activation, so editing it during a transition does not change that transition. `copyVariant: "legacy"` restores the previous second phrase; the default reads «И решил начать с одной маленькой искры.».

The existing `Moonlit Letter` and `Stardust` presets remain available; `Vasilisa Cinematic` presets Scene 07's palette, star density and lighting. The galaxy section stores seeded geometry, live shader values, background and foreground gas, reveal timing, camera staging, and an independent custom palette. Geometry controls rebuild after a 280 ms quiet interval; shader uniforms update live. Geometry and materials are disposed when replaced or unmounted. Scene 07, 08, and 09 share one persistent scene graph and one renderer. The ending uses the shared FilmClock presentation channel for slow motion while its film state remains ended. Global quality, DPR and playback settings remain global and are not changed by prologue-specific controls. The store owns neither a playback clock nor a canvas.

The preparation defaults keep the existing composition: heading scale `1`, heading line height `1.08`, and card surface opacity `1`. These settings use `--preparation-type-scale`, `--preparation-line-height`, and `--preparation-card-opacity`; reset restores the defaults.

The only accepted art font IDs are `marck-script`, `bad-script`, `caveat`, and `cormorant-garamond`. They are declared in `fontIds.ts`; `fontCatalog.ts` defines the corresponding local CSS family, readiness call, and checked Russian glyph set. Font files use SIL Open Font License 1.1; see `src/assets/typography/` for license texts and attribution.
