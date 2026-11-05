# macOS recording build and recovery

## Build the Apple Silicon app

Run these commands on an Apple Silicon Mac with Xcode Command Line Tools and Node.js 22 installed:

```sh
cd frontend
npm ci
npm run desktop:ffmpeg:mac
npm run check
npm run build:mac:dir
```

The FFmpeg build script pins upstream FFmpeg 8.1.3 and verifies its source archive with SHA-256 before extracting it. It compiles arm64 executables with `--disable-gpl --disable-nonfree`; the source archive, LGPL license texts, notices, and exact configure options are included beside `ffmpeg` and `ffprobe`. The generated tools are copied to `frontend/resources/macos-arm64/`, checked for Apple arm64, version, and license flags, and packaged in `A Little Universe for You.app/Contents/Resources/ffmpeg/`, outside `app.asar`.

The first FFmpeg build needs network access to fetch the pinned source archive unless that archive is already cached under `frontend/.cache/`. The running app does not download or contact a server. Once built, it plays and records offline and does not require Node.js to launch.

The GitHub Actions workflow `.github/workflows/macos-arm64.yml` repeats the build and checks on the `macos-15` Apple Silicon runner, verifies the FFmpeg files inside the `.app`, and uploads the application artifact. A successful workflow run is required before treating that artifact as verified.

## Permissions and recording

macOS must grant Camera, Microphone, and Screen Recording (named Screen & System Audio Recording on some macOS versions) access to **A Little Universe for You**. The bundle has camera, microphone, and screen-capture usage descriptions in its Info.plist. Grant these in System Settings → Privacy & Security before launching, or accept the normal system prompt. The app does not attempt to bypass TCC. If access is unavailable, the start screen explains which permission to enable.

There is one launch path: read the recording notice and confirm. Capture starts only after that confirmation; the film then starts automatically. The viewer can stop from the on-screen **Stop & Save** control. The owner can use **Stop & Save** in DEV → Recording. Scene transitions, credits, and replay do not stop the recording.

## Files, timelines, and recovery

Each recording is stored in `~/Movies/A_Little_Universe_Records/session_YYYY-MM-DD_HH-MM-SS/`. Source chunks are written incrementally as separate `camera/segment_####.webm`, `microphone/segment_####.webm`, and `screen/segment_####.webm` files. The manifest and recording log contain source timestamps, relative `timelineMs` offsets, byte counts, decode results, and errors.

Stop & Save closes the sources, asks FFmpeg to decode every original segment, and then creates `final/camera_full.mp4`, `final/microphone_full.m4a`, and `final/screen_full.mp4`. FFmpeg writes a temporary output, and the app publishes it only after FFmpeg decode and ffprobe duration checks pass. `final/combined.mp4` is attempted only when all three sources are usable. It places camera video in a picture-in-picture panel and delays each clip/audio segment by its recorded relative offset. Known gaps remain black or silent; failed or missing source data is never compressed out of the timeline or presented as exact synchronization.

The original segments are never deleted or overwritten. If finalization fails, its error and any incomplete temporary output stay in the session folder so that the originals remain available for recovery. The next app launch scans canonical local session directories, repairs an atomic temporary manifest when possible, marks active segments interrupted, and rechecks any session whose finalization did not complete. It does not use network storage.

DEV → Recording shows source states, elapsed time, saved segment counts, free space, finalization result/files, errors, **Stop & Save**, and **Open Recording Folder**. The viewer sees the finalization status and can open the session folder after stopping.

## Validation record

Windows automated tests use the system `ffmpeg` and `ffprobe` with synthetic VP8/Opus WebM fixtures. They check real decoding, independently playable MP4/M4A outputs, duration and silence gaps, combined timeline offsets, a corrupt input, a path traversal attempt, crash/restart recovery, and preservation of original file hashes. The test fixtures are synthetic and contain no personal media.

The Apple Silicon FFmpeg compile, `.app` packaging, TCC prompts, camera/microphone capture, window capture, WebGL performance, repeated film viewing, and a physical crash/relaunch still require execution on a MacBook. CI can verify arm64 packaging and local media processing, but cannot substitute for those physical-device checks.
