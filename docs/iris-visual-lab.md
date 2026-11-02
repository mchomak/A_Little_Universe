# Iris Visual Lab

This local look-development tool is separate from the film and never requests camera or microphone access. Its route and asset server exist only in Vite development. Do not expose the dev server publicly: derived iris images are personally meaningful.

## Run

From the repository root in PowerShell:

```powershell
python frontend/scripts/publish-iris-assets.py
cd frontend
npm ci
npm run dev
```

Open `http://127.0.0.1:5173/dev/iris-lab`. If port 5173 is already occupied, reuse the project's running development server or stop it and run the command again. The production build does not expose the lab. If assets are missing, rerun the first command; the lab reports the error instead of substituting an iris.

The pipeline copies only selected derivatives from `iris-reconstruction-kit/experiments/run_017_requirements_env` into `frontend/dev-assets/iris/vasilisa/`. The original photo and annotation are not copied. See the [asset contract](iris-lab-assets.md) for the schema, orientation and integrity checks. Settings never modify reconstruction data.

## Controls

Drag to orbit and use the wheel to zoom. View buttons select starting angles. The camera can be locked or saved and restored separately with Save camera and Load camera. The diagnostic menu displays the color and authentic textures, confidence map or raw particles.

The panel contains groups for camera, geometry, materials, lighting, particles, fibers, effects, visibility and Iris Color Grading. The grading controls use localized color and radial masks to shift gray-green fibers toward blue while protecting amber around the pupil. A small neighborhood average guides the color mask while the correction is applied to each original texel, so radial detail stays sharp. Color operations convert linear-sRGB samples to sRGB and back before Three.js output conversion. Original, Natural Blue, Cool Blue and Cinematic Blue are available, along with Manual control. Grading parameters are stored with the rest of the versioned configuration and affect the iris texture, particles and fibers while leaving pupil, sclera, lids, lashes and cornea reflections untouched. Reset group restores one group; Reset restores the entire configuration. Hide controls collapses the panel. Low, Standard and High profiles adjust DPR and density. Frame rate and resource counts are browser diagnostics, not measurements of GPU memory.

Select a built-in preset or use Save preset to create a named local preset. The browser automatically saves the current settings in localStorage; they do not sync across devices and can be removed when browser storage is cleared. Export downloads versioned JSON; Import validates it and retains current settings when it fails. Use JSON to transfer settings between devices. Screenshot saves the canvas.

The lab is intended for manual artistic review. Integration into scene 06, galaxy transition and gaze tracking are outside this implementation. Physical tablet and Safari verification remain separate tasks.

## Scene 06 look-development modes

The original eye assembly remains the default. The lab now offers four compositions: **Original** preserves the existing model view; **Memory Signal** shows a particle reconstruction; **Fire Eye Fibers** shows the iris and pupil with an added radial fiber shader, while the full model remains available through its independent visibility toggle; and **Hybrid** combines the model, particle reconstruction, legacy detail layers and the new procedural fibers. The view-mode selector sets a useful starting mix. Model, Memory Signal and fiber visibility and opacity can then be adjusted separately. The A/B button switches between Original and Hybrid with the current camera unchanged.

Memory Signal uses paired 640 × 640 offscreen renders of the existing eye assembly as its default source. The current textured iris, pupil, sclera, lids and lashes are captured through the lab's renderer. A second depth pass stores the nearest visible model surface for each pixel, so the resulting cloud follows the actual assembly under orbit instead of sitting on a flat or synthetic dome. The capture is resampled to a maximum of 220,000 points by default (configurable to 400,000). Each retained pixel contributes its color and brightness; brightness adds bounded Z relief and emission, while neighboring coverage drives edge softening and edge-weighted curl displacement. A connected border-color mask and the alpha cutoff remove the background. The brightness threshold affects relief and emission independently, so an enclosed dark pupil remains a dark feature. The curl displacement, edge diffusion, particle size and glow are adjusted through the existing lab controls. The original model is captured without the newly added fiber layer to keep the particle source stable.

The optional image input replaces the model capture only for the current browser session. Image pixels are read from a local object URL on-device; the image is not uploaded or included in presets or JSON exports. Transparent images use their alpha channel. For opaque images, the edge-background tolerance flood-fills only pixels connected to the image border and similar to its median edge color. Choose a tolerance that fits the image's background, and use the alpha cutoff for soft edges. The image and derived point buffers are released when the source changes or the page closes.

Fire Eye fibers run in the existing iris shader. They use several bands of gradient-noise fBm in polar coordinates, gentle domain warping and bounded angular drift to create thin radial fibers, larger uneven plumes and small branches. The shader adds the cool blue and silver structure directly over the iris, so it remains visible with Bloom disabled. Density changes the radial fiber count and opacity; length changes the radial fade toward the limbus; curvature changes domain warp and angular drift; branching adds short secondary strands. These controls remain active with the geometric fiber layers disabled. Noise scale, fine and coarse frequency, radial alignment, width, brightness, opacity, depth and animation speed are also adjustable. Existing blue grading and the artistic fiber color remain separate from the source eye texture.

The new groups expose model opacity, particle count/size/relief/noise/thresholds, fiber density/width/frequencies/curvature/opacity/depth and the prior camera, color, Bloom and motion controls. View settings are saved in schema v4; v1–v3 exports migrate with Original as the starting view. Built-in presets include **Original**, **Memory Signal**, **Blue Fibers** and **Hybrid Cinematic**, alongside the existing inspection presets. The custom image itself is intentionally not serialized.

The implementation adapts techniques from the MIT projects [memory-signal-threejs](https://github.com/shuhari04/memory-signal-threejs) (Canvas RGBA sampling, brightness relief, edge weighting, curl displacement and screen-space points) and [fire-eye](https://github.com/TanerTalas/fire-eye) (radial fBm, multiple frequencies and domain warping). Their notices are kept in [THIRD-PARTY-NOTICES.md](../frontend/src/iris-lab/THIRD-PARTY-NOTICES.md). The shader methods are adapted to the existing Three.js scene; neither reference application is copied into this project.

The storyboard keeps Scene 06 conditional and asks for a restrained blue/silver eye, with no gaze tracking or extra transition work. The lab remains an isolated look-development tool; this change does not decide whether Scene 06 ships in the film.
