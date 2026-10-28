# Scene Composer configuration

`SceneComposerConfig` is an immutable schema version 2. `normalizeConfig(input)` accepts partial schema v2 and older schema v1 JSON; unknown keys are discarded and missing or invalid values use the v2 defaults. The store publishes font changes only after the selected local font is ready.

The public store is:

- `normalizeConfig(input: unknown): SceneComposerConfig`
- `loadStartupConfig(): Promise<void>`
- `getConfig(): SceneComposerConfig`
- `subscribeConfig(listener: (config: SceneComposerConfig) => void): () => void`
- `updateConfig(patch: SceneComposerConfigPatch): Promise<SceneComposerConfig>`
- `resetConfig(scope: ConfigResetScope): Promise<SceneComposerConfig>`

`loadStartupConfig` fetches `${BASE_URL}scene-composer.json` after preload; failure or malformed JSON leaves the active snapshot unchanged. Composer import and export use the same normalizer and store. Exported JSON uses schema v2.

Schema v1 migration preserves the other recognized scene and global settings. Legacy `particleSpeed` maps to `windStrength` using `clamp(particleSpeed × 1.15, 0.2, 3)`, and `particleSpread` maps to `turbulence` using `particleSpread × 0.3`. Legacy particle counts below the v2 minimum are raised to 300. `particleDuration` keeps its existing 0.1–20 second travel-window meaning and default of 4 seconds; the new `particleFadeDuration` controls ash fade and defaults to 2.4 seconds. `particleReturnFraction` is ignored because the ash effect no longer returns particles to the center. Missing v2 fields receive v2 defaults.

An optional production override can contain only values that differ from the defaults:

```json
{
  "schemaVersion": 2,
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
      "fractureDuration": 2.6,
      "particleDuration": 4,
      "particleFadeDuration": 2.4,
      "promptHandwritingDuration": 0.65,
      "glow": 0.45
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
| Prologue | Fracture width | 0–0.18 of text width; default 0.08 |
| Prologue | Fracture and ash fade duration | 0.8–4 s (default 2.6), 0.5–4 s (default 2.4) |
| Prologue | Particle travel-window duration | 0.1–20 s; default 4 |
| Prologue | Prompt handwriting duration | 0.2–0.8 s; default 0.65 |
| Prologue | Glow, pulse amplitude/frequency, seed | 0–2 (default 0.45), 0–1, 0–5, integer 0–2147483647 |

The existing `Moonlit Letter` and `Stardust` presets remain available. Global quality, DPR and playback settings remain global and are not changed by prologue-specific controls. The store owns neither a playback clock nor a canvas.

The preparation defaults keep the existing composition: heading scale `1`, heading line height `1.08`, and card surface opacity `1`. These settings use `--preparation-type-scale`, `--preparation-line-height`, and `--preparation-card-opacity`; reset restores the defaults.

The only accepted art font IDs are `marck-script`, `bad-script`, `caveat`, and `cormorant-garamond`. They are declared in `fontIds.ts`; `fontCatalog.ts` defines the corresponding local CSS family, readiness call, and checked Russian glyph set. Font files use SIL Open Font License 1.1; see `src/assets/typography/` for license texts and attribution.
