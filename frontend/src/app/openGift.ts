import type { MediaSnapshot } from '../systems/media/MediaSession'

export interface GiftServices {
  audio: { unlock(): Promise<boolean> }
  media: {
    getSnapshot(): Pick<MediaSnapshot, 'options' | 'recordingStatus'> & { error?: string | null }
    prepare?(): Promise<boolean>
    start(): Promise<boolean | void>
  }
  onStart(): void
}

export async function openGift({ audio, media, onStart }: GiftServices): Promise<void> {
  // Both permission and capture APIs must be invoked synchronously by the consent click.
  let audioReady: Promise<boolean>
  try { audioReady = audio.unlock() } catch { audioReady = Promise.resolve(false) }
  void audioReady.catch(() => false)
  const snapshot = media.getSnapshot()
  let recording: Promise<boolean | void> = Promise.resolve(true)
  if (snapshot.options.recording && snapshot.recordingStatus !== 'recording') {
    if (snapshot.recordingStatus === 'ready') {
      // Electron's getDisplayMedia must be invoked in this click stack.
      try { recording = media.start() } catch (error) { recording = Promise.reject(error) }
    } else {
      let ready: Promise<boolean>
      if (media.prepare) {
        try { ready = media.prepare() } catch { ready = Promise.resolve(false) }
      } else ready = Promise.resolve(false)
      recording = ready.then((prepared) => {
        if (!prepared) throw new Error(media.getSnapshot().error ?? 'Camera and local recording could not be prepared.')
        return media.start()
      })
    }
  }
  const [recordingResult] = await Promise.allSettled([recording])
  // Audio is optional. Recording is required when it was explicitly requested.
  if (snapshot.options.recording && (recordingResult.status !== 'fulfilled' || recordingResult.value === false)) {
    throw new Error(media.getSnapshot().error ?? 'Local recording could not be started.')
  }
  onStart()
}
