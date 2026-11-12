/**
 * ClashKing season strings are not consistent across eras. They can look like
 * "2026-08-03" or "2024-12". CWL is monthly, so comparisons happen at month
 * granularity while the original string is kept for API requests.
 */
export function seasonKey(season: string): string {
  const match = /^(\d{4})-(\d{2})/.exec(season.trim())
  return match ? `${match[1]}-${match[2]}` : season.trim()
}

export function seasonSortValue(season: string): number {
  const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(season.trim())
  if (!match) return 0
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3] ?? 1))
}

export function formatSeasonLabel(season: string): string {
  const match = /^(\d{4})-(\d{2})/.exec(season.trim())
  if (!match) return season

  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1))
  return new Intl.DateTimeFormat('en', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(date)
}

/** Safe fragment for file names. */
export function seasonFileFragment(season: string): string {
  return seasonKey(season).replace(/[^0-9A-Za-z._-]+/g, '-')
}
