export interface PlaybackState {
  readonly paused: boolean
  readonly revision: number
}

export type PlaybackAction = { type: 'toggle-pause' } | { type: 'replay' }

export const initialPlayback: PlaybackState = { paused: false, revision: 0 }

export function playbackReducer(state: PlaybackState, action: PlaybackAction): PlaybackState {
  switch (action.type) {
    case 'toggle-pause':
      return { ...state, paused: !state.paused }
    case 'replay':
      return { paused: false, revision: state.revision + 1 }
  }
}
