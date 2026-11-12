import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ClashKingClient, type ClashKingClientOptions } from './client'
import { JsonCache } from './cache'

const tempDirs: string[] = []

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'raven-client-'))
  tempDirs.push(dir)
  return dir
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers)
  if (!headers.has('content-type')) headers.set('content-type', 'application/json')
  return new Response(JSON.stringify(body), { ...init, headers })
}

function makeClient(cacheDir: string, overrides: Partial<ClashKingClientOptions> = {}): ClashKingClient {
  return new ClashKingClient({ cacheDir, ...overrides })
}

describe('ClashKingClient', () => {
  it('fetches and caches seasons', async () => {
    const cacheDir = await makeTempDir()
    const urls: string[] = []
    const client = makeClient(cacheDir, {
      fetchImpl: async (input) => {
        urls.push(String(input))
        return jsonResponse({ items: [{ season: '2026-08', state: 'ended' }] })
      }
    })

    const first = await client.getSeasons('#2AAAAAAA')
    const second = await client.getSeasons('#2AAAAAAA')

    expect(first.fromCache).toBe(false)
    expect(first.data).toEqual([{ season: '2026-08', state: 'ended' }])
    expect(second.fromCache).toBe(true)
    expect(urls).toHaveLength(1)
    expect(urls[0]).toContain('/v2/cwl/%232AAAAAAA/seasons?limit=24')
  })

  it('caches group payloads permanently', async () => {
    const cacheDir = await makeTempDir()
    let calls = 0
    const client = makeClient(cacheDir, {
      fetchImpl: async (input) => {
        calls += 1
        expect(String(input)).toContain('season=2026-08')
        return jsonResponse({ state: 'ended', season: '2026-08', rounds: [] })
      }
    })

    await client.getGroup('#2AAAAAAA', '2026-08')
    const second = await client.getGroup('#2AAAAAAA', '2026-08')

    expect(calls).toBe(1)
    expect(second.fromCache).toBe(true)
  })

  it('maps a 404 to not_found without retrying', async () => {
    const cacheDir = await makeTempDir()
    let calls = 0
    const client = makeClient(cacheDir, {
      fetchImpl: async () => {
        calls += 1
        return new Response('not here', { status: 404 })
      }
    })

    await expect(client.getSeasons('#2AAAAAAA')).rejects.toMatchObject({
      code: 'not_found',
      retryable: false
    })
    expect(calls).toBe(1)
  })

  it('retries server errors using retry-after', async () => {
    const cacheDir = await makeTempDir()
    let calls = 0
    const client = makeClient(cacheDir, {
      fetchImpl: async () => {
        calls += 1
        if (calls === 1) {
          return new Response('temporary', { status: 503, headers: { 'retry-after': '0.01' } })
        }
        return jsonResponse({ items: [{ season: '2026-08', state: 'ended' }] })
      }
    })

    const result = await client.getSeasons('#2AAAAAAA')

    expect(calls).toBe(2)
    expect(result.data).toEqual([{ season: '2026-08', state: 'ended' }])
  })

  it('reports rate limiting after exhausting retries', async () => {
    const cacheDir = await makeTempDir()
    let calls = 0
    const client = makeClient(cacheDir, {
      maxRetries: 1,
      fetchImpl: async () => {
        calls += 1
        return new Response('slow down', { status: 429, headers: { 'retry-after': '0.01' } })
      }
    })

    await expect(client.getSeasons('#2AAAAAAA')).rejects.toMatchObject({
      code: 'rate_limited',
      retryable: true,
      status: 429
    })
    expect(calls).toBe(2)
  })

  it('rejects malformed JSON responses', async () => {
    const cacheDir = await makeTempDir()
    const client = makeClient(cacheDir, {
      maxRetries: 0,
      fetchImpl: async () => new Response('not json', { status: 200 })
    })

    await expect(client.getSeasons('#2AAAAAAA')).rejects.toMatchObject({
      code: 'invalid_response'
    })
  })

  it('rejects JSON with an unexpected shape', async () => {
    const cacheDir = await makeTempDir()
    const client = makeClient(cacheDir, {
      maxRetries: 0,
      fetchImpl: async () => jsonResponse({ items: 'nope' })
    })

    await expect(client.getSeasons('#2AAAAAAA')).rejects.toMatchObject({
      code: 'invalid_response'
    })
  })

  it('maps aborted requests to timeout errors', async () => {
    const cacheDir = await makeTempDir()
    const client = makeClient(cacheDir, {
      timeoutMs: 20,
      maxRetries: 0,
      fetchImpl: (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => reject(new DOMException('Aborted', 'AbortError')),
            { once: true }
          )
        })
    })

    await expect(client.getSeasons('#2AAAAAAA')).rejects.toMatchObject({
      code: 'timeout',
      retryable: true
    })
  })

  it('maps network failures to a network error', async () => {
    const cacheDir = await makeTempDir()
    const client = makeClient(cacheDir, {
      maxRetries: 0,
      fetchImpl: async () => {
        throw new TypeError('fetch failed')
      }
    })

    await expect(client.getSeasons('#2AAAAAAA')).rejects.toMatchObject({
      code: 'network',
      retryable: true
    })
  })

  it('falls back to stale seasons data when the network fails', async () => {
    const cacheDir = await makeTempDir()
    const goodClient = makeClient(cacheDir, {
      fetchImpl: async () => jsonResponse({ items: [{ season: '2026-08', state: 'ended' }] })
    })
    await goodClient.getSeasons('#2AAAAAAA')

    const cacheFile = new JsonCache(cacheDir).pathFor('seasons-2AAAAAAA')
    const envelope = JSON.parse(await readFile(cacheFile, 'utf8'))
    envelope.fetchedAt = Date.now() - 16 * 60 * 1000
    await writeFile(cacheFile, JSON.stringify(envelope), 'utf8')

    const failingClient = makeClient(cacheDir, {
      maxRetries: 0,
      fetchImpl: async () => new Response('down', { status: 503 })
    })
    const result = await failingClient.getSeasons('#2AAAAAAA')

    expect(result.fromCache).toBe(true)
    expect(result.stale).toBe(true)
    expect(result.data).toEqual([{ season: '2026-08', state: 'ended' }])
  })

  it('deduplicates concurrent identical requests', async () => {
    const cacheDir = await makeTempDir()
    let calls = 0
    const client = makeClient(cacheDir, {
      fetchImpl: async () => {
        calls += 1
        await new Promise((resolve) => setTimeout(resolve, 10))
        return jsonResponse({ items: [{ season: '2026-08', state: 'ended' }] })
      }
    })

    const [first, second] = await Promise.all([
      client.getSeasons('#2AAAAAAA'),
      client.getSeasons('#2AAAAAAA')
    ])

    expect(calls).toBe(1)
    expect(first.data).toEqual(second.data)
  })

  it('honors an already-aborted signal', async () => {
    const cacheDir = await makeTempDir()
    const client = makeClient(cacheDir, {
      fetchImpl: async () => jsonResponse({ items: [] })
    })
    const controller = new AbortController()
    controller.abort()

    await expect(client.getSeasons('#2AAAAAAA', controller.signal)).rejects.toMatchObject({
      code: 'cancelled'
    })
  })
})
