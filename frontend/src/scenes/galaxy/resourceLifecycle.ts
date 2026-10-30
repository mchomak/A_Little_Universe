interface DisposableGalaxyClouds {
  dispose(): void
}

/** Defer release until after StrictMode's synchronous effect replay can reclaim the memoized cloud group. */
export function deferGalaxyCloudDisposal<T extends DisposableGalaxyClouds>(clouds: T, mounted: WeakSet<object>) {
  mounted.delete(clouds)
  queueMicrotask(() => {
    if (!mounted.has(clouds)) clouds.dispose()
  })
}
