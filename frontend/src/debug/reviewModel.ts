import { SCENES, type SceneId } from '../engine/filmConfig'
export type Priority = 'low' | 'medium' | 'high'
export type Status = 'open' | 'in_progress' | 'ready_for_review' | 'done'
export interface ReviewNote { id: string; sceneId: SceneId; frameId: string; localTimeSeconds: number; capturedMode: string; checkpoint: { galleryIndex: number; reading: boolean }; createdAt: string; text: string; priority: Priority; status: Status; screenshotPath: string; viewport: { width: number; height: number; dpr: number }; config: unknown }
export function canRestoreReview(note: Pick<ReviewNote, 'sceneId' | 'capturedMode' | 'localTimeSeconds'> & Partial<Pick<ReviewNote, 'checkpoint'>>) { return !note.checkpoint?.reading && note.capturedMode === 'playing' && note.sceneId !== 'bloom' && SCENES[note.sceneId].entryMode === 'playing' && note.localTimeSeconds < SCENES[note.sceneId].duration }
