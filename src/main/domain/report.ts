import { randomUUID } from 'node:crypto'
import type { PlayerRow, ProgressEvent, ReportData, ReportWarning } from '@shared/types'
import { sortClansByLeague, sortPlayersByLeague } from '@shared/league'
import { normalizeTag } from '@shared/tags'
import { formatSeasonLabel } from '@shared/seasons'
import { ClashKingClient, ClashKingError } from '../clashking/client'
import type { CwlGroup, SeasonInfo } from '../clashking/types'
import { aggregateClan, buildReportStats } from './aggregate'
import { selectLatestEndedSeason, type ClanSeasons } from './seasons'

export class ReportError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'ReportError'
  }
}

export interface GenerateReportOptions {
  tags: string[]
  client: ClashKingClient
  signal: AbortSignal
  onProgress?: (event: ProgressEvent) => void
}

interface ClanSeasonFetch {
  clanTag: string
  seasons: SeasonInfo[]
  error?: ClashKingError
}

interface ClanGroupFetch {
  clanTag: string
  season: SeasonInfo
  group?: CwlGroup
  error?: ClashKingError
}

const CONCURRENCY = 3

export async function generateReport(options: GenerateReportOptions): Promise<ReportData> {
  const { client, signal, onProgress } = options
  const tags = [...new Set(options.tags.map((tag) => normalizeTag(tag)).filter(isTag))]

  if (tags.length === 0) {
    throw new ReportError('invalid-input', 'Add at least one valid clan tag.')
  }

  const warnings: ReportWarning[] = []
  let completed = 0

  const seasonFetches = await mapWithConcurrency(tags, CONCURRENCY, async (clanTag) => {
    throwIfAborted(signal)
    try {
      const result = await client.getSeasons(clanTag, signal)
      completed += 1
      emitProgress(onProgress, {
        phase: 'seasons',
        current: completed,
        total: tags.length,
        clanTag,
        message: `Checked ${clanTag}`
      })
      return { clanTag, seasons: result.data }
    } catch (error) {
      if (isCancelled(error)) throw error
      completed += 1
      emitProgress(onProgress, {
        phase: 'seasons',
        current: completed,
        total: tags.length,
        clanTag,
        message: `Could not check ${clanTag}`
      })
      return {
        clanTag,
        seasons: [],
        error: error instanceof ClashKingError ? error : undefined
      } satisfies ClanSeasonFetch
    }
  })

  const usable: ClanSeasons[] = []
  for (const fetch of seasonFetches) {
    if (fetch.error) {
      warnings.push(warningFromError(fetch.clanTag, undefined, fetch.error))
      continue
    }
    if (fetch.seasons.length === 0) {
      warnings.push(
        makeWarning(
          'untracked',
          'This clan is not tracked by ClashKing.',
          fetch.clanTag,
          undefined,
          'Add it to a Discord server with ClashKing using /addclan, then generate the report again.'
        )
      )
      continue
    }
    if (!fetch.seasons.some((season) => season.state === 'ended')) {
      warnings.push(
        makeWarning(
          'no-ended-season',
          'No ended CWL season is available for this clan yet.',
          fetch.clanTag,
          undefined,
          'The current CWL may still be in progress. Try again after it ends.'
        )
      )
      continue
    }
    usable.push({ clanTag: fetch.clanTag, seasons: fetch.seasons })
  }

  const selection = selectLatestEndedSeason(usable)
  if (!selection) {
    throw new ReportError(
      'no-season',
      'None of the requested clans has an ended CWL season in ClashKing.'
    )
  }

  for (const missing of selection.missing) {
    const detail = missing.latestAvailable
      ? `Latest available season: ${formatSeasonLabel(missing.latestAvailable)} (${missing.latestAvailable}).`
      : 'No ended CWL seasons are available for this clan.'
    warnings.push(
      makeWarning(
        'missing-season',
        `No data for ${selection.label}.`,
        missing.clanTag,
        undefined,
        detail
      )
    )
  }

  const groupFetches = await mapWithConcurrency(
    selection.matches,
    CONCURRENCY,
    async (match): Promise<ClanGroupFetch> => {
      throwIfAborted(signal)
      try {
        const result = await client.getGroup(match.clanTag, match.season.season, signal)
        completed += 1
        emitProgress(onProgress, {
          phase: 'groups',
          current: completed,
          total: tags.length + selection.matches.length,
          clanTag: match.clanTag,
          message: `Loaded ${selection.label} for ${match.clanTag}`
        })
        return { clanTag: match.clanTag, season: match.season, group: result.data }
      } catch (error) {
        if (isCancelled(error)) throw error
        completed += 1
        emitProgress(onProgress, {
          phase: 'groups',
          current: completed,
          total: tags.length + selection.matches.length,
          clanTag: match.clanTag,
          message: `Could not load ${match.clanTag}`
        })
        return {
          clanTag: match.clanTag,
          season: match.season,
          error: error instanceof ClashKingError ? error : undefined
        }
      }
    }
  )

  emitProgress(onProgress, {
    phase: 'aggregate',
    current: tags.length + selection.matches.length,
    total: tags.length + selection.matches.length,
    message: 'Aggregating player statistics'
  })

  const clans: ReportData['clans'] = []
  const players: PlayerRow[] = []

  for (const fetch of groupFetches) {
    if (!fetch.group) {
      warnings.push(warningFromError(fetch.clanTag, undefined, fetch.error))
      continue
    }

    const result = aggregateClan({
      clanTag: fetch.clanTag,
      season: fetch.season,
      group: fetch.group
    })
    clans.push(result.clan)
    players.push(...result.players)
    warnings.push(...result.warnings)
  }

  if (clans.length === 0) {
    throw new ReportError(
      'no-data',
      'ClashKing did not return CWL data for any of the selected clans.'
    )
  }

  players.sort(
    (a, b) =>
      a.clan.localeCompare(b.clan, 'en') ||
      b.attackStars - a.attackStars ||
      a.name.localeCompare(b.name, 'en')
  )

  // Keep one table, but group every clan by CWL league, strongest first.
  const orderedClans = sortClansByLeague(clans)
  const orderedPlayers = sortPlayersByLeague(players, orderedClans)

  const generatedAt = new Date().toISOString()
  const report: ReportData = {
    reportId: randomUUID(),
    season: selection.season,
    seasonKey: selection.key,
    seasonLabel: selection.label,
    generatedAt,
    clans: orderedClans,
    players: orderedPlayers,
    warnings: dedupeWarnings(warnings),
    stats: buildReportStats(players, orderedClans.length)
  }

  emitProgress(onProgress, {
    phase: 'done',
    current: tags.length + selection.matches.length,
    total: tags.length + selection.matches.length,
    message: 'Report ready'
  })

  return report
}

function warningFromError(
  clanTag: string,
  clanName: string | undefined,
  error: ClashKingError | undefined
): ReportWarning {
  if (!error) {
    return makeWarning(
      'fetch-error',
      'Could not load data for this clan.',
      clanTag,
      clanName,
      'An unexpected error occurred.'
    )
  }

  if (error.code === 'not_found') {
    return makeWarning(
      'untracked',
      'This clan is not tracked by ClashKing.',
      clanTag,
      clanName,
      'Add it to a Discord server with ClashKing using /addclan, then generate the report again.'
    )
  }

  const messages: Record<string, string> = {
    rate_limited: 'ClashKing is busy right now. Try again in a moment.',
    timeout: 'ClashKing took too long to respond.',
    network: 'Could not reach ClashKing. Check your internet connection.',
    invalid_response: 'ClashKing returned data in an unexpected format.',
    http_error: 'ClashKing returned an error.',
    cancelled: 'The request was cancelled.'
  }

  return makeWarning(
    'fetch-error',
    messages[error.code] ?? 'Could not load data for this clan.',
    clanTag,
    clanName,
    error.message
  )
}

function makeWarning(
  kind: ReportWarning['kind'],
  message: string,
  clanTag?: string,
  clanName?: string,
  detail?: string
): ReportWarning {
  return { kind, message, clanTag, clanName, detail }
}

function dedupeWarnings(warnings: ReportWarning[]): ReportWarning[] {
  const seen = new Set<string>()
  return warnings.filter((warning) => {
    const key = `${warning.kind}|${warning.clanTag ?? ''}|${warning.message}|${warning.detail ?? ''}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function emitProgress(
  listener: ((event: ProgressEvent) => void) | undefined,
  event: ProgressEvent
): void {
  listener?.(event)
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new ClashKingError('cancelled', 'Report generation was cancelled')
  }
}

function isCancelled(error: unknown): boolean {
  return error instanceof ClashKingError && error.code === 'cancelled'
}

function isTag(value: string | null): value is string {
  return value !== null
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let nextIndex = 0

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = nextIndex
      nextIndex += 1
      if (index >= items.length) return
      results[index] = await mapper(items[index])
    }
  })

  await Promise.all(workers)
  return results
}
