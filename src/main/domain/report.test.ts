import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { ProgressEvent } from '@shared/types'
import type { CwlGroup, SeasonInfo } from '../clashking/types'
import { ClashKingClient } from '../clashking/client'
import { generateReport } from './report'
import { CLAN_TAG, makeAggregationFixture } from './testFixtures'

const TAG_A = CLAN_TAG
const TAG_B = '#2BBBBBBB'
const TAG_C = '#2CCCCCCC'
const TAG_D = '#2DDDDDDD'

const tempDirs: string[] = []

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'raven-report-'))
  tempDirs.push(dir)
  return dir
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

interface FakeApiOptions {
  seasons: Record<string, SeasonInfo[]>
  groups?: Record<string, CwlGroup | number>
}

function makeFakeFetch({ seasons, groups = {} }: FakeApiOptions): typeof fetch {
  return async (input) => {
    const url = new URL(String(input))
    const segments = decodeURIComponent(url.pathname).split('/')
    const tag = segments[3]
    const endpoint = segments[4]

    if (endpoint === 'seasons') {
      return new Response(JSON.stringify({ items: seasons[tag] ?? [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    }

    if (endpoint === 'group') {
      const season = url.searchParams.get('season') ?? ''
      const group = groups[`${tag}:${season}`]
      if (typeof group === 'number') {
        return new Response('upstream error', { status: group })
      }
      if (group) {
        return new Response(JSON.stringify(group), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      }
      return new Response('not found', { status: 404 })
    }

    return new Response('not found', { status: 404 })
  }
}

async function makeClient(fetchImpl: typeof fetch): Promise<ClashKingClient> {
  return new ClashKingClient({ cacheDir: await makeTempDir(), fetchImpl, maxRetries: 0 })
}

const endedAugust: SeasonInfo = { season: '2026-08', state: 'ended' }
const endedJuly: SeasonInfo = { season: '2026-07', state: 'ended' }

describe('generateReport', () => {
  it('builds a report for the latest ended season across all clans', async () => {
    const fixture = makeAggregationFixture()
    const client = await makeClient(
      makeFakeFetch({
        seasons: {
          [TAG_A]: [endedAugust, endedJuly],
          [TAG_B]: [endedJuly],
          [TAG_C]: []
        },
        groups: { [`${TAG_A}:2026-08`]: fixture.group }
      })
    )

    const report = await generateReport({
      tags: ['2aaaaaaa', '#2BBBBBBB', TAG_C],
      client,
      signal: new AbortController().signal
    })

    expect(report.season).toBe('2026-08')
    expect(report.seasonLabel).toBe('August 2026')
    expect(report.clans).toHaveLength(1)
    expect(report.clans[0]).toMatchObject({ tag: TAG_A, name: 'Raven Clan', players: 3 })
    expect(report.players).toHaveLength(3)
    expect(report.stats).toMatchObject({
      clans: 1,
      players: 3,
      attacks: 4,
      missed: 2,
      attackStars: 8,
      defenses: 5,
      avgStars: 2,
      avgDefense: 1.8
    })

    expect(report.warnings).toContainEqual(
      expect.objectContaining({
        kind: 'untracked',
        clanTag: TAG_C
      })
    )
    expect(report.warnings).toContainEqual(
      expect.objectContaining({
        kind: 'missing-season',
        clanTag: TAG_B,
        message: 'No data for August 2026.'
      })
    )
  })

  it('orders clans and the single player table by league rank', async () => {
    const fixture = makeAggregationFixture()
    const legendSeason: SeasonInfo = {
      ...endedAugust,
      warLeague: { id: 48000022, name: 'Legend League' }
    }
    const bronzeSeason: SeasonInfo = {
      ...endedAugust,
      warLeague: { id: 48000020, name: 'Bronze League I' }
    }
    const client = await makeClient(
      makeFakeFetch({
        seasons: {
          [TAG_A]: [legendSeason],
          [TAG_B]: [bronzeSeason]
        },
        groups: {
          [`${TAG_A}:2026-08`]: fixture.group,
          [`${TAG_B}:2026-08`]: fixture.group
        }
      })
    )

    const report = await generateReport({
      tags: [TAG_B, TAG_A],
      client,
      signal: new AbortController().signal
    })

    expect(report.clans.map((clan) => clan.league)).toEqual([
      'Legend League',
      'Bronze League I'
    ])
    expect(report.players.length).toBeGreaterThan(3)
    expect(report.players.slice(0, 3).every((player) => player.clanTag === TAG_A)).toBe(true)
    expect(report.players.at(-1)?.clanTag).toBe(TAG_B)
  })

  it('reports progress for every phase', async () => {
    const fixture = makeAggregationFixture()
    const client = await makeClient(
      makeFakeFetch({
        seasons: { [TAG_A]: [endedAugust] },
        groups: { [`${TAG_A}:2026-08`]: fixture.group }
      })
    )
    const events: ProgressEvent[] = []

    await generateReport({
      tags: [TAG_A],
      client,
      signal: new AbortController().signal,
      onProgress: (event) => events.push(event)
    })

    expect(events.some((event) => event.phase === 'seasons')).toBe(true)
    expect(events.some((event) => event.phase === 'groups')).toBe(true)
    expect(events.some((event) => event.phase === 'aggregate')).toBe(true)
    expect(events.at(-1)?.phase).toBe('done')
  })

  it('stops immediately when the signal is already aborted', async () => {
    const fixture = makeAggregationFixture()
    const client = await makeClient(
      makeFakeFetch({
        seasons: { [TAG_A]: [endedAugust] },
        groups: { [`${TAG_A}:2026-08`]: fixture.group }
      })
    )
    const controller = new AbortController()
    controller.abort()

    await expect(
      generateReport({ tags: [TAG_A], client, signal: controller.signal })
    ).rejects.toMatchObject({ code: 'cancelled' })
  })

  it('fails when no clan has an ended season', async () => {
    const client = await makeClient(
      makeFakeFetch({
        seasons: {
          [TAG_A]: [{ season: '2026-09', state: 'preparation' }],
          [TAG_C]: []
        }
      })
    )

    await expect(
      generateReport({ tags: [TAG_A, TAG_C], client, signal: new AbortController().signal })
    ).rejects.toMatchObject({ code: 'no-season' })
  })

  it('rejects an empty tag list', async () => {
    const client = await makeClient(makeFakeFetch({ seasons: {} }))

    await expect(
      generateReport({ tags: [], client, signal: new AbortController().signal })
    ).rejects.toMatchObject({ code: 'invalid-input' })
  })

  it('keeps the report when one clan group fails to load', async () => {
    const fixture = makeAggregationFixture()
    const client = await makeClient(
      makeFakeFetch({
        seasons: {
          [TAG_A]: [endedAugust],
          [TAG_D]: [endedAugust]
        },
        groups: {
          [`${TAG_A}:2026-08`]: fixture.group,
          [`${TAG_D}:2026-08`]: 500
        }
      })
    )

    const report = await generateReport({
      tags: [TAG_A, TAG_D],
      client,
      signal: new AbortController().signal
    })

    expect(report.clans).toHaveLength(1)
    expect(report.warnings).toContainEqual(
      expect.objectContaining({
        kind: 'fetch-error',
        clanTag: TAG_D
      })
    )
  })

  it('fails when every group request fails', async () => {
    const client = await makeClient(
      makeFakeFetch({
        seasons: { [TAG_A]: [endedAugust] },
        groups: { [`${TAG_A}:2026-08`]: 500 }
      })
    )

    await expect(
      generateReport({ tags: [TAG_A], client, signal: new AbortController().signal })
    ).rejects.toMatchObject({ code: 'no-data' })
  })
})
