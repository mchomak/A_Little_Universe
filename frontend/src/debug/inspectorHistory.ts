/** Isolated histories with field-level patches, so external edits are preserved. */
type Scope = 'global' | 'openingBackground' | 'preload' | 'prologue' | 'growth' | 'bloom' | 'identity' | 'gallery' | 'galaxy' | 'greeting'
type Snapshot = object
type Entry = { before: Snapshot; after: Snapshot; relatedBefore?: Snapshot; relatedAfter?: Snapshot }
export function createInspectorHistory() {
  const stacks = new Map<Scope, { past: Entry[]; future: Entry[] }>()
  const stack = (scope: Scope) => {
    let current = stacks.get(scope)
    if (!current) { current = { past: [], future: [] }; stacks.set(scope, current) }
    return current
  }
  const move = (scope: Scope, direction: 'undo' | 'redo') => {
    const current = stack(scope)
    const item = direction === 'undo' ? current.past.pop() : current.future.pop()
    if (!item) return undefined
    if (direction === 'undo') current.future.push(item)
    else current.past.push(item)
    return { patch: direction === 'undo' ? item.before : item.after, relatedPatch: direction === 'undo' ? item.relatedBefore : item.relatedAfter }
  }
  return {
    record(scope: Scope, before: Snapshot, after: Snapshot) {
      const original = before as Record<string, unknown>; const updated = after as Record<string, unknown>
      const keys = Object.keys(updated).filter(key => !Object.is(original[key], updated[key]))
      if (!keys.length) return
      const current = stack(scope)
      current.past.push({ before: Object.fromEntries(keys.map(key => [key, original[key]])), after: Object.fromEntries(keys.map(key => [key, updated[key]])) })
      if (current.past.length > 100) current.past.shift()
      current.future = []
    },
    recordPreset(scope: Scope, before: Snapshot, after: Snapshot, relatedBefore: Snapshot, relatedAfter: Snapshot) {
      const original = before as Record<string, unknown>; const updated = after as Record<string, unknown>
      const keys = Object.keys(updated).filter(key => !Object.is(original[key], updated[key]))
      const bgBefore = relatedBefore as Record<string, unknown>; const bgAfter = relatedAfter as Record<string, unknown>
      const relatedKeys = Object.keys(bgAfter).filter(key => !Object.is(bgBefore[key], bgAfter[key]))
      if (!keys.length && !relatedKeys.length) return
      const current = stack(scope)
      current.past.push({
        before: Object.fromEntries(keys.map(key => [key, original[key]])),
        after: Object.fromEntries(keys.map(key => [key, updated[key]])),
        relatedBefore: Object.fromEntries(relatedKeys.map(key => [key, bgBefore[key]])),
        relatedAfter: Object.fromEntries(relatedKeys.map(key => [key, bgAfter[key]])),
      })
      if (current.past.length > 100) current.past.shift()
      current.future = []
    },
    canUndo: (scope: Scope) => stack(scope).past.length > 0,
    canRedo: (scope: Scope) => stack(scope).future.length > 0,
    undo(scope: Scope) { return move(scope, 'undo')?.patch },
    redo(scope: Scope) { return move(scope, 'redo')?.patch },
    undoTransaction(scope: Scope) { return move(scope, 'undo') },
    redoTransaction(scope: Scope) { return move(scope, 'redo') },
    clear() { stacks.clear() },
  }
}
export type InspectorScope = Scope
