/** Isolated histories with field-level patches, so external edits are preserved. */
type Scope = 'global' | 'preload' | 'preparation' | 'prologue' | 'growth' | 'bloom' | 'galaxy'
type Snapshot = object
type Entry = { before: Snapshot; after: Snapshot }
export function createInspectorHistory() {
  const stacks = new Map<Scope, { past: Entry[]; future: Entry[] }>()
  const stack = (scope: Scope) => {
    let current = stacks.get(scope)
    if (!current) { current = { past: [], future: [] }; stacks.set(scope, current) }
    return current
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
    canUndo: (scope: Scope) => stack(scope).past.length > 0,
    canRedo: (scope: Scope) => stack(scope).future.length > 0,
    undo(scope: Scope) { const current = stack(scope); const item = current.past.pop(); if (!item) return undefined; current.future.push(item); return item.before },
    redo(scope: Scope) { const current = stack(scope); const item = current.future.pop(); if (!item) return undefined; current.past.push(item); return item.after },
    clear() { stacks.clear() },
  }
}
export type InspectorScope = Scope
