import { onScopeDispose, ref } from 'vue'

export type DataFreshness = 'missing' | 'fresh' | 'stale'

export function getDataFreshness(updatedAt: number, now: number, staleAfterMs = 3000): DataFreshness {
  if (updatedAt === 0) return 'missing'
  if (updatedAt < 0) return 'stale'
  return now - updatedAt > staleAfterMs ? 'stale' : 'fresh'
}

/**
 * Reactive wall clock for UI freshness checks.
 * Date.now() alone is not reactive, so a computed value would otherwise stay
 * cached after incoming data stops.
 */
export function useFreshnessClock(intervalMs = 1000) {
  const now = ref(Date.now())
  const timer = window.setInterval(() => {
    now.value = Date.now()
  }, intervalMs)

  onScopeDispose(() => window.clearInterval(timer))

  return now
}
