import { z } from 'zod'
import type { CwlGroup, SeasonInfo } from './types'
import { JsonCache } from './cache'

const SEASONS_TTL_MS = 15 * 60 * 1000
const USER_AGENT = 'RavenHubCWLReport/0.1.0 (desktop report app; data by ClashKing)'

const SeasonsResponseSchema = z
  .object({
    items: z.array(z.object({ season: z.string(), state: z.string() }).passthrough())
  })
  .passthrough()

const GroupResponseSchema = z
  .object({
    state: z.string(),
    season: z.string(),
    rounds: z.array(z.object({ warTags: z.array(z.unknown()) }).passthrough())
  })
  .passthrough()

export type ClashKingErrorCode =
  | 'not_found'
  | 'rate_limited'
  | 'network'
  | 'timeout'
  | 'invalid_response'
  | 'http_error'
  | 'cancelled'

export class ClashKingError extends Error {
  constructor(
    public readonly code: ClashKingErrorCode,
    message: string,
    public readonly retryable = false,
    public readonly status?: number,
    public readonly retryAfterMs?: number
  ) {
    super(message)
    this.name = 'ClashKingError'
  }
}

export interface ClashKingResult<T> {
  data: T
  fromCache: boolean
  stale: boolean
}

export interface ClashKingClientOptions {
  cacheDir: string
  baseUrl?: string
  fetchImpl?: typeof fetch
  userAgent?: string
  timeoutMs?: number
  groupTimeoutMs?: number
  maxRetries?: number
}

interface RequestOptions {
  signal?: AbortSignal
  timeoutMs: number
}

export class ClashKingClient {
  private readonly cache: JsonCache
  private readonly baseUrl: string
  private readonly fetchImpl: typeof fetch
  private readonly userAgent: string
  private readonly timeoutMs: number
  private readonly groupTimeoutMs: number
  private readonly maxRetries: number
  private readonly inFlight = new Map<string, Promise<unknown>>()

  constructor(options: ClashKingClientOptions) {
    this.cache = new JsonCache(options.cacheDir)
    this.baseUrl = (options.baseUrl ?? 'https://api.clashk.ing').replace(/\/+$/, '')
    this.fetchImpl = options.fetchImpl ?? fetch
    this.userAgent = options.userAgent ?? USER_AGENT
    this.timeoutMs = options.timeoutMs ?? 20_000
    this.groupTimeoutMs = options.groupTimeoutMs ?? 45_000
    this.maxRetries = options.maxRetries ?? 2
  }

  async getSeasons(tag: string, signal?: AbortSignal): Promise<ClashKingResult<SeasonInfo[]>> {
    const key = `seasons-${tag.replace(/^#/, '')}`

    return this.dedupe(key, async () => {
      const cached = await this.cache.read<SeasonInfo[]>(key, SEASONS_TTL_MS)
      if (cached && !cached.stale) {
        return { data: cached.data, fromCache: true, stale: false }
      }

      try {
        const response = await this.request(
          `/v2/cwl/${encodeURIComponent(tag)}/seasons?limit=24`,
          SeasonsResponseSchema,
          { signal, timeoutMs: this.timeoutMs }
        )
        const data = response.items as SeasonInfo[]
        await this.cache.write(key, data)
        return { data, fromCache: false, stale: false }
      } catch (error) {
        if (cached) {
          return { data: cached.data, fromCache: true, stale: true }
        }
        throw error
      }
    })
  }

  async getGroup(
    tag: string,
    season: string,
    signal?: AbortSignal
  ): Promise<ClashKingResult<CwlGroup>> {
    const key = `group-${tag.replace(/^#/, '')}-${season}`

    return this.dedupe(key, async () => {
      const cached = await this.cache.read<CwlGroup>(key, Number.POSITIVE_INFINITY)
      if (cached) {
        return { data: cached.data, fromCache: true, stale: false }
      }

      const response = await this.request(
        `/v2/cwl/${encodeURIComponent(tag)}/group?season=${encodeURIComponent(season)}`,
        GroupResponseSchema,
        { signal, timeoutMs: this.groupTimeoutMs }
      )
      const data = response as CwlGroup
      await this.cache.write(key, data)
      return { data, fromCache: false, stale: false }
    })
  }

  private dedupe<T>(key: string, factory: () => Promise<T>): Promise<T> {
    const existing = this.inFlight.get(key)
    if (existing) return existing as Promise<T>

    const promise = factory().finally(() => {
      this.inFlight.delete(key)
    })
    this.inFlight.set(key, promise)
    return promise
  }

  private async request<T>(
    path: string,
    schema: z.ZodType<T>,
    options: RequestOptions
  ): Promise<T> {
    let lastError: unknown

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      if (options.signal?.aborted) throw cancelledError()

      try {
        return await this.requestOnce(path, schema, options)
      } catch (error) {
        lastError = error
        const retryable = error instanceof ClashKingError && error.retryable
        if (!retryable || attempt === this.maxRetries) break

        const delay =
          (error instanceof ClashKingError && error.retryAfterMs) ||
          Math.min(8_000, 500 * 2 ** attempt) + Math.floor(Math.random() * 250)
        await sleep(delay, options.signal)
      }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError))
  }

  private async requestOnce<T>(
    path: string,
    schema: z.ZodType<T>,
    options: RequestOptions
  ): Promise<T> {
    const controller = new AbortController()
    let timedOut = false

    const timer = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, options.timeoutMs)

    const onAbort = (): void => controller.abort()
    options.signal?.addEventListener('abort', onAbort, { once: true })

    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': this.userAgent
        },
        signal: controller.signal
      })

      if (!response.ok) {
        const retryAfterMs = parseRetryAfter(response.headers.get('retry-after'))
        const detail = await response.text().catch(() => '')
        const suffix = detail ? `: ${detail.slice(0, 220)}` : ''

        if (response.status === 404) {
          throw new ClashKingError(
            'not_found',
            `ClashKing has no data for this request${suffix}`,
            false,
            404
          )
        }
        if (response.status === 429) {
          throw new ClashKingError(
            'rate_limited',
            `ClashKing is rate limiting requests${suffix}`,
            true,
            429,
            retryAfterMs
          )
        }
        if (response.status >= 500) {
          throw new ClashKingError(
            'http_error',
            `ClashKing returned HTTP ${response.status}${suffix}`,
            true,
            response.status,
            retryAfterMs
          )
        }
        throw new ClashKingError(
          'http_error',
          `ClashKing returned HTTP ${response.status}${suffix}`,
          false,
          response.status
        )
      }

      let json: unknown
      try {
        json = await response.json()
      } catch {
        throw new ClashKingError('invalid_response', 'ClashKing returned invalid JSON')
      }

      try {
        return schema.parse(json)
      } catch {
        throw new ClashKingError(
          'invalid_response',
          'ClashKing returned data in an unexpected format'
        )
      }
    } catch (error) {
      if (options.signal?.aborted) throw cancelledError()
      if (timedOut) {
        throw new ClashKingError('timeout', 'ClashKing took too long to respond', true)
      }
      if (error instanceof ClashKingError) throw error
      throw new ClashKingError(
        'network',
        'Could not reach ClashKing. Check your internet connection and try again.',
        true
      )
    } finally {
      clearTimeout(timer)
      options.signal?.removeEventListener('abort', onAbort)
    }
  }
}

function cancelledError(): ClashKingError {
  return new ClashKingError('cancelled', 'Report generation was cancelled')
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(cancelledError())
      return
    }

    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)

    const onAbort = (): void => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
      reject(cancelledError())
    }

    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined

  const seconds = Number(value)
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000

  const date = Date.parse(value)
  if (Number.isFinite(date)) return Math.max(0, date - Date.now())
  return undefined
}
