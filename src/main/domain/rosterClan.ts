import { seasonKey, seasonSortValue } from '@shared/seasons'
import { normalizeTag } from '@shared/tags'
import type { RosterClanLoadResponse } from '@shared/types'
import { ClashKingError, type ClashKingClient } from '../clashking/client'
import type { SeasonInfo } from '../clashking/types'
import { aggregateClan } from './aggregate'

export type RosterClanErrorCode =
  | 'invalid-tag'
  | 'no-season'
  | 'not-tracked'
  | 'rate-limited'
  | 'network'
  | 'fetch-error'

export class RosterClanError extends Error {
  constructor(
    public readonly code: RosterClanErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'RosterClanError'
  }
}

export interface LoadRosterClanOptions {
  tag: string
  seasonKey?: string | null
  client: Pick<ClashKingClient, 'getSeasons' | 'getGroup'>
  signal?: AbortSignal
}

/**
 * Loads a clan that is not part of the source report. The roster season is
 * preferred so the added clan contributes players from the same CWL month;
 * legacy rosters without a stored key fall back to the newest ended season.
 */
export async function loadRosterClan({
  tag: rawTag,
  seasonKey: wantedSeasonKey,
  client,
  signal
}: LoadRosterClanOptions): Promise<RosterClanLoadResponse> {
  const tag = normalizeTag(rawTag)
  if (!tag) {
    throw new RosterClanError(
      'invalid-tag',
      'Enter a valid clan tag, for example #2PP or #8QU8J9LP.'
    )
  }

  let seasons: SeasonInfo[]
  try {
    seasons = (await client.getSeasons(tag, signal)).data
  } catch (error) {
    throw translateError(error)
  }

  const ended = seasons.filter((season) => season.state === 'ended')
  const wanted = wantedSeasonKey ? seasonKey(wantedSeasonKey) : null
  let season: SeasonInfo | undefined

  if (wanted) {
    season = ended.find((candidate) => seasonKey(candidate.season) === wanted)
    if (!season) {
      throw new RosterClanError(
        'no-season',
        'This clan did not play CWL in the season used by this roster.'
      )
    }
  } else {
    season = [...ended].sort(
      (first, second) => seasonSortValue(second.season) - seasonSortValue(first.season)
    )[0]
    if (!season) {
      throw new RosterClanError(
        'no-season',
        'This clan has no completed CWL season in ClashKing yet.'
      )
    }
  }

  let group
  try {
    group = (await client.getGroup(tag, season.season, signal)).data
  } catch (error) {
    throw translateError(error)
  }

  const result = aggregateClan({ clanTag: tag, season, group })
  return {
    clan: {
      tag,
      name: result.clan.name,
      league: result.clan.league
    },
    players: result.players,
    seasonKey: seasonKey(season.season)
  }
}

function translateError(error: unknown): RosterClanError {
  if (error instanceof RosterClanError) return error

  if (error instanceof ClashKingError) {
    if (error.code === 'not_found') {
      return new RosterClanError(
        'not-tracked',
        'ClashKing does not have this clan. Add it with /addclan on a Discord server using ClashKing and try again.'
      )
    }
    if (error.code === 'rate_limited') {
      return new RosterClanError(
        'rate-limited',
        'ClashKing is busy right now. Try adding the clan again in a moment.'
      )
    }
    if (error.code === 'network' || error.code === 'timeout') {
      return new RosterClanError(
        'network',
        'Could not reach ClashKing. Check your internet connection and try again.'
      )
    }
    return new RosterClanError('fetch-error', 'ClashKing could not load this clan. Try again.')
  }

  console.error('Unexpected roster clan error:', error)
  return new RosterClanError(
    'fetch-error',
    'Something went wrong while loading this clan. Please try again.'
  )
}
