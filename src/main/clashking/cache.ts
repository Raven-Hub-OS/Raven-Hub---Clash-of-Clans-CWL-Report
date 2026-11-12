import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

interface CacheEnvelope<T> {
  fetchedAt: number
  data: T
}

export interface CachedValue<T> {
  data: T
  fetchedAt: number
  stale: boolean
}

/**
 * Small JSON cache on disk. It is deliberately disposable: a corrupted or
 * missing cache file is treated as a cache miss, never as a fatal error.
 */
export class JsonCache {
  constructor(private readonly root: string) {}

  async read<T>(key: string, ttlMs: number): Promise<CachedValue<T> | null> {
    try {
      const raw = await readFile(this.pathFor(key), 'utf8')
      const parsed = JSON.parse(raw) as CacheEnvelope<T>
      if (!parsed || typeof parsed.fetchedAt !== 'number' || !('data' in parsed)) return null

      return {
        data: parsed.data,
        fetchedAt: parsed.fetchedAt,
        stale: Date.now() - parsed.fetchedAt > ttlMs
      }
    } catch {
      return null
    }
  }

  async write<T>(key: string, data: T): Promise<void> {
    const target = this.pathFor(key)
    await mkdir(dirname(target), { recursive: true })

    const envelope: CacheEnvelope<T> = { fetchedAt: Date.now(), data }
    const temp = `${target}.${process.pid}.${Date.now()}.tmp`

    try {
      await writeFile(temp, JSON.stringify(envelope), 'utf8')
      try {
        await rename(temp, target)
      } catch {
        await rm(target, { force: true })
        await rename(temp, target)
      }
    } catch {
      await rm(temp, { force: true }).catch(() => undefined)
    }
  }

  pathFor(key: string): string {
    const safe = key.replace(/[^0-9A-Za-z._-]+/g, '_')
    return join(this.root, `${safe}.json`)
  }
}
