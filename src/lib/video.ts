import type { Place } from '../types'

/**
 * A YouTube search for a preview of the place (on-ride POV for rides). A
 * search rather than one fixed video: always has results, never a dead link.
 * On iPhone it opens in the YouTube app when installed.
 */
export function videoUrl(p: Place): string | null {
  if (p.hidden || p.video === '') return null
  const q = p.video ?? [p.name, p.area].filter(Boolean).join(' ')
  return `https://www.youtube.com/results?${new URLSearchParams({ search_query: q })}`
}
