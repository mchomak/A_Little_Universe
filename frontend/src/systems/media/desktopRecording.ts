import { DesktopRecordingSession } from './DesktopRecordingSession'

export const desktopRecording = new DesktopRecordingSession()

// The packaged application starts capture during bootstrap, before assets load.
if (!import.meta.env.DEV && typeof location !== 'undefined' && location.protocol === 'app:' && location.hostname === 'bundle') {
  desktopRecording.installCloseHandler()
  void desktopRecording.startAutomatically().catch(() => undefined)
}
