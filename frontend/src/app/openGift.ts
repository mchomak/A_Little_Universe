import type { MediaSnapshot } from '../systems/media/MediaSession'

export interface GiftServices {
  audio: { unlock(): Promise<boolean> }
  media: { getSnapshot(): Pick<MediaSnapshot, 'options' | 'recordingStatus'>; start(): Promise<boolean> }
  onStart(): void
}

export async function openGift({ audio, media, onStart }: GiftServices): Promise<void> {
  // Invoked synchronously from the gift button, before the first await.
  let audioReady: Promise<boolean>
  try { audioReady = audio.unlock() } catch { audioReady = Promise.resolve(false) }
  const snapshot = media.getSnapshot()
  let recording = Promise.resolve(false)
  if (snapshot.options.recording && snapshot.recordingStatus === 'ready') {
    try { recording = media.start() } catch { recording = Promise.resolve(false) }
  }
  await Promise.allSettled([audioReady, recording])
  onStart()
}
