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
