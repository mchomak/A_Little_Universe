# Local reaction recording

`MediaSession` belongs to the application, outside the Canvas and scene lifecycle.
Create one instance, subscribe with `useSyncExternalStore`, and call `restore()` to
discover earlier files without requesting devices or restoring consent.

`setOptions({ gaze, recording })` only changes current consent. Both options start
false on each reload. `prepare()` must come from the explicit permission-check
action; it acquires front video (`facingMode: { ideal: 'user' }`) and adds audio
only for recording. Unknown physical facing mode is reported honestly. A failed
check returns false and never blocks film playback. No tracker is implemented.

Call `start()` only after the explicit gift button, with recording consent still
true. It requires prepared, live video and audio and a supported MediaRecorder
MIME. It never requests permissions itself. Call `stop()` on the final scene and
from the always-available recording control. `dispose()` is application cleanup.
Stopping releases the microphone and releases video too when gaze is disabled.
Do not mutate or stop tracks returned by `getVideoStream()` from a scene.

Native IndexedDB stores session metadata and ordered Blob chunks in the database
`little-universe-reactions-v1`. Chunk and metadata updates share transactions;
success means transaction commit. The recorder requests four-second slices
(actual event intervals depend on the browser). A serialized queue holds at most
eight pending chunks and 32 MiB before stopping with an incomplete-file warning.
The final recorder event and queued commits complete before `saved` is published.
Quota, recorder and device failures preserve confirmed chunks for export.

`export(id)` reads durable chunks and returns `{ blob, filename, incomplete }`.
It does not claim the user saved a file. RecoveryPanel requests a browser download
and asks the viewer to check Downloads. Incomplete media may not be playable.
`delete(id)` removes both metadata and chunks after the UI's explicit confirmation.
Storage can be evicted by the browser: export important recordings promptly.

Pagehide attempts to stop and commit, closes device tracks, and marks the result
incomplete. Browser termination can lose the last pending fragments. On restore,
sessions still marked recording are displayed as incomplete without restarting.
The service has no network path: upload is unavailable and upload consent is
always false until a protected server mechanism is implemented separately.

Unit tests exercise the public service with synthetic devices and a deterministic
storage adapter for delayed commits/quota failures. Native IndexedDB, browser
MediaRecorder, device permissions, Safari, prolonged capture and storage eviction
also require browser/device validation; synthetic tests are not physical-camera
or tablet evidence.
