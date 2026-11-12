import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ClashKingClient } from '../clashking/client'
import { CLAN_TAG, makeAggregationFixture } from './testFixtures'
import { loadRosterClan } from './rosterClan'

const tempDirs: string[] = []

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'raven-roster-clan-'))
  tempDirs.push(dir)
  return dir
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

function makeFetch(season: string): typeof fetch {
  const fixture = makeAggregationFixture()

  return async (input) => {
    const url = new URL(String(input))
    const segments = decodeURIComponent(url.pathname).split('/')
    const tag = segments[3]
    const endpoint = segments[4]

    if (endpoint === 'seasons') {
      return new Response(
        JSON.stringify({ items: [{ season, state: 'ended' }, { season: '2026-07', state: 'ended' }] }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    }
    if (endpoint === 'group' && tag === CLAN_TAG) {
      return new Response(JSON.stringify(fixture.group), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    }
    return new Response('not found', { status: 404 })
  }
}

async function makeClient(fetchImpl: typeof fetch): Promise<ClashKingClient> {
  return new ClashKingClient({ cacheDir: await makeTempDir(), fetchImpl, maxRetries: 0 })
}

describe('loadRosterClan', () => {
  it('loads the clan and its players for the requested roster season', async () => {
    const fixture = makeAggregationFixture()
    const client = await makeClient(makeFetch('2026-07'))

    const result = await loadRosterClan({
      tag: '2aaaaaaa',
      seasonKey: '2026-07',
      client
    })

    expect(result.seasonKey).toBe('2026-07')
    expect(result.clan).toMatchObject({
      tag: CLAN_TAG,
      name: 'Raven Clan',
      league: fixture.season.warLeague?.name
    })
    expect(result.players).toHaveLength(3)
    expect(result.players[0]).toMatchObject({ clanTag: CLAN_TAG, clan: 'Raven Clan' })
  })

  it('falls back to the latest ended season when the roster has no key', async () => {
    const client = await makeClient(makeFetch('2026-08'))

    const result = await loadRosterClan({ tag: CLAN_TAG, client })

    expect(result.seasonKey).toBe('2026-08')
  })

  it('rejects a clan that did not play the requested season', async () => {
    const client = await makeClient(makeFetch('2026-06'))

    await expect(
      loadRosterClan({ tag: CLAN_TAG, seasonKey: '2026-08', client })
    ).rejects.toMatchObject({ code: 'no-season' })
  })

  it('rejects invalid tags before calling ClashKing', async () => {
    const client = await makeClient(makeFetch('2026-08'))

    await expect(
      loadRosterClan({ tag: 'not a tag!', seasonKey: '2026-08', client })
    ).rejects.toMatchObject({ code: 'invalid-tag' })
  })

  it('reports clans missing from ClashKing as not tracked', async () => {
    const client = await makeClient(async () => new Response('missing', { status: 404 }))

    await expect(
      loadRosterClan({ tag: CLAN_TAG, seasonKey: '2026-08', client })
    ).rejects.toMatchObject({ code: 'not-tracked' })
  })
})
