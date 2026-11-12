import { normalizeTag } from './tags'
import type { PlayerRow } from './types'

const LEAGUE_TIERS = [
  'bronze',
  'silver',
  'gold',
  'crystal',
  'master',
  'champion',
  'titan',
  'legend'
] as const

export interface ParsedLeague {
  /** Zero-based tier, from Bronze (0) to Legend (7). */
  tier: number
  /** 1 for I, 2 for II, 3 for III. Null when the league has no division. */
  division: number | null
}

export interface ClanLeague {
  tag: string
  name: string
  league: string | null
}

/**
 * CWL league names arrive as "Champion League III", "Legend League", and
 * occasionally without the word "League". Unknown values sort below every
 * known league.
 */
export function parseLeague(league: string | null | undefined): ParsedLeague | null {
  const text = (league ?? '').trim().toLowerCase()
  if (!text) return null

  const tier = LEAGUE_TIERS.findIndex((name) => new RegExp(`\\b${name}\\b`).test(text))
  if (tier === -1) return null

  const match = /\b(iii|ii|i)\b/i.exec(text)
  const division = match ? divisionValue(match[1]) : null
  return { tier, division }
}

/** Higher values are stronger. Unknown leagues use -1. */
export function leagueSortValue(league: string | null | undefined): number {
  const parsed = parseLeague(league)
  if (!parsed) return -1

  // Division I (1) is stronger than III (3), so subtract the division.
  return (parsed.tier + 1) * 10 - (parsed.division ?? 0)
}

/** Sort comparator that puts the strongest league first. */
export function compareLeagues(
  first: string | null | undefined,
  second: string | null | undefined
): number {
  return leagueSortValue(second) - leagueSortValue(first)
}

export function leagueLabel(league: string | null | undefined): string {
  const text = league?.trim()
  return text ? text : 'Unranked'
}

export function sortClansByLeague<T extends { name: string; league: string | null }>(
  clans: T[]
): T[] {
  return [...clans].sort(
    (first, second) =>
      compareLeagues(first.league, second.league) ||
      first.name.localeCompare(second.name, 'en')
  )
}

/**
 * Stable league ordering for a single report or roster table. Players from
 * clans missing from the list sort after every known league.
 */
export function sortPlayersByLeague(
  players: PlayerRow[],
  clans: Array<{ tag: string; league: string | null }>
): PlayerRow[] {
  const leagueByClan = new Map<string, string | null>()
  for (const clan of clans) {
    const tag = normalizeTag(clan.tag) ?? clan.tag
    leagueByClan.set(tag, clan.league)
  }

  return players
    .map((player, index) => ({ player, index }))
    .sort((first, second) => {
      const firstTag = normalizeTag(first.player.clanTag) ?? first.player.clanTag
      const secondTag = normalizeTag(second.player.clanTag) ?? second.player.clanTag
      return (
        compareLeagues(leagueByClan.get(firstTag) ?? null, leagueByClan.get(secondTag) ?? null) ||
        first.index - second.index
      )
    })
    .map((entry) => entry.player)
}

function divisionValue(value: string): number {
  if (value.toLowerCase() === 'iii') return 3
  if (value.toLowerCase() === 'ii') return 2
  return 1
}
