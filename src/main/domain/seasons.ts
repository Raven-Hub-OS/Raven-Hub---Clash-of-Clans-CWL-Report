import { formatSeasonLabel, seasonKey, seasonSortValue } from '@shared/seasons'
import type { SeasonInfo } from '../clashking/types'

export interface ClanSeasons {
  clanTag: string
  seasons: SeasonInfo[]
}

export interface SeasonMatch {
  clanTag: string
  season: SeasonInfo
}

export interface SeasonMissing {
  clanTag: string
  latestAvailable: string | null
}

export interface SelectedSeason {
  season: string
  key: string
  label: string
  sortValue: number
  matches: SeasonMatch[]
  missing: SeasonMissing[]
  coveredCount: number
}

/**
 * Picks the newest ended CWL season across all clans. Clans expose a season
 * list in newest-first order, but the app still sorts by parsed date because
 * ClashKing has used more than one season string format over time.
 */
export function selectLatestEndedSeason(clans: ClanSeasons[]): SelectedSeason | null {
  const prepared = clans.map((clan) => {
    const ended = clan.seasons
      .filter((season) => season.state === 'ended')
      .sort((a, b) => seasonSortValue(b.season) - seasonSortValue(a.season))
    return { clanTag: clan.clanTag, ended }
  })

  const candidates = prepared
    .filter((entry) => entry.ended.length > 0)
    .map((entry) => {
      const latest = entry.ended[0]
      return {
        clanTag: entry.clanTag,
        season: latest,
        key: seasonKey(latest.season),
        sortValue: seasonSortValue(latest.season)
      }
    })

  if (candidates.length === 0) return null

  const coverage = (key: string): number =>
    prepared.filter((entry) => entry.ended.some((season) => seasonKey(season.season) === key)).length

  candidates.sort(
    (a, b) => b.sortValue - a.sortValue || coverage(b.key) - coverage(a.key)
  )

  const chosen = candidates[0]
  const matches: SeasonMatch[] = []
  const missing: SeasonMissing[] = []

  for (const entry of prepared) {
    const match = entry.ended.find((season) => seasonKey(season.season) === chosen.key)
    if (match) {
      matches.push({ clanTag: entry.clanTag, season: match })
    } else {
      missing.push({
        clanTag: entry.clanTag,
        latestAvailable: entry.ended[0]?.season ?? null
      })
    }
  }

  return {
    season: chosen.season.season,
    key: chosen.key,
    label: formatSeasonLabel(chosen.season.season),
    sortValue: chosen.sortValue,
    matches,
    missing,
    coveredCount: matches.length
  }
}
