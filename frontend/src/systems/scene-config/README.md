# Scene Composer configuration

`SceneComposerConfig` is schema version 1. Defaults live in `config.ts`; JSON is treated as a partial override. Missing fields use defaults, known invalid fields use their field default, unsupported explicit schema versions reset to the defaults, and unknown fields are discarded.

The public store is:

- `normalizeConfig(input: unknown): SceneComposerConfig`
- `loadStartupConfig(): Promise<void>`
- `getConfig(): SceneComposerConfig`
- `subscribeConfig(listener: (config: SceneComposerConfig) => void): () => void`
- `updateConfig(patch: SceneComposerConfigPatch): Promise<SceneComposerConfig>`
- `resetConfig(scope: ConfigResetScope): Promise<SceneComposerConfig>`

`updateConfig` waits for newly selected local font faces before publishing the new immutable snapshot. `loadStartupConfig` fetches `${BASE_URL}scene-composer.json` after the real preload has emitted `ready`; its rejection or malformed JSON leaves the current snapshot intact.

The optional production file can contain only the values that should differ from defaults:

```json
{
  "schemaVersion": 1,
  "scenes": {
    "prologue": {
      "fontFamily": "marck-script",
      "fontSize": 52,
      "particleCount": 2100
    }
  }
}
```

The only accepted art font IDs are `marck-script`, `bad-script`, `caveat`, and `cormorant-garamond`. They are declared in `fontIds.ts`; `fontCatalog.ts` defines the corresponding local CSS family, readiness call, and checked Russian glyph set. All four files use SIL Open Font License 1.1; see `src/assets/typography/` for the full license texts and attribution.

## Normalization ranges

| Section | Field | Accepted range |
|---|---|---:|
| Global | DPR min / max | 0.5–1.5 / 1–2, with min ≤ max |
| Global | Playback speed | 0.25–4 |
| Preload | Glow, particle count, movement speed, collapse duration | 0–2, 40–300 integer, 0.1–4, 0–4 |
| Preparation | Spacing, entrance duration | 0–64, 0–5 |
| Prologue | Font size, line height, position Y | 16–160, 0.8–2.5, 10–80 |
| Prologue | Handwriting duration/rhythm, phrase interval, readable hold | 0.5–20, 0.1–3, 0–8, 0–30 |
| Prologue | Particle count/speed/duration/spread/return fraction | 100–6000 integer, 0.1–10, 0.1–20, 0–2, 0–1 |
| Prologue | Glow, pulse amplitude/frequency, seed | 0–2, 0–1, 0–5, integer 0–2147483647 |

`SCENE_CONFIG_PRESETS` exposes the `moonlit-letter` and `stardust` partial presets. The store does not create its own playback clock or canvas.
