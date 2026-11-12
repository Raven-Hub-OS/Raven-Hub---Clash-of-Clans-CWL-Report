import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { JsonCache } from './cache'

const tempDirs: string[] = []

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'raven-cache-'))
  tempDirs.push(dir)
  return dir
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('JsonCache', () => {
  it('writes and reads a value', async () => {
    const dir = await makeTempDir()
    const cache = new JsonCache(dir)

    await cache.write('seasons-2AAAAAAA', [{ season: '2026-08', state: 'ended' }])
    const cached = await cache.read<Array<{ season: string }>>('seasons-2AAAAAAA', 60_000)

    expect(cached?.data).toEqual([{ season: '2026-08', state: 'ended' }])
    expect(typeof cached?.fetchedAt).toBe('number')
    expect(cached?.stale).toBe(false)
  })

  it('marks values older than the ttl as stale', async () => {
    const dir = await makeTempDir()
    const cache = new JsonCache(dir)

    await cache.write('key', { value: 1 })
    await new Promise((resolve) => setTimeout(resolve, 5))
    const cached = await cache.read<{ value: number }>('key', 1)

    expect(cached?.data).toEqual({ value: 1 })
    expect(cached?.stale).toBe(true)
  })

  it('treats a missing file as a cache miss', async () => {
    const cache = new JsonCache(await makeTempDir())

    expect(await cache.read('missing', 60_000)).toBeNull()
  })

  it('treats corrupted JSON as a cache miss', async () => {
    const dir = await makeTempDir()
    const cache = new JsonCache(dir)
    await writeFile(cache.pathFor('broken'), '{not json', 'utf8')

    expect(await cache.read('broken', 60_000)).toBeNull()
  })

  it('treats an invalid envelope as a cache miss', async () => {
    const dir = await makeTempDir()
    const cache = new JsonCache(dir)
    await writeFile(cache.pathFor('shape'), JSON.stringify({ data: 1 }), 'utf8')

    expect(await cache.read('shape', 60_000)).toBeNull()
  })

  it('sanitizes keys into safe file names', async () => {
    const dir = await makeTempDir()
    const cache = new JsonCache(dir)
    const path = cache.pathFor('group-#2AAAAAAA/2026-08')

    expect(path.startsWith(dir)).toBe(true)
    expect(path).not.toContain('#')
    expect(path).not.toContain('/2026')
    expect(await readFile(path, 'utf8').catch(() => null)).toBeNull()
  })

  it('overwrites existing values', async () => {
    const cache = new JsonCache(await makeTempDir())

    await cache.write('key', { value: 1 })
    await cache.write('key', { value: 2 })

    expect((await cache.read<{ value: number }>('key', 60_000))?.data).toEqual({ value: 2 })
  })
})
