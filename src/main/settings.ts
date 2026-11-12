import type { AppSettings } from '@shared/types'
import { readJsonFile, writeJsonAtomic } from './storage/jsonFile'

const DEFAULT_SETTINGS: AppSettings = {
  version: 1,
  lastTags: [],
  lastReportFolderId: null,
  lastRosterFolderId: null
}

export class SettingsStore {
  private settings: AppSettings | null = null
  private queue: Promise<unknown> = Promise.resolve()

  constructor(private readonly filePath: string) {}

  async get(): Promise<AppSettings> {
    if (this.settings) return { ...this.settings }

    const loaded = await readJsonFile<unknown>(this.filePath, null)
    this.settings = sanitizeSettings(loaded)
    return { ...this.settings }
  }

  async update(patch: Partial<Omit<AppSettings, 'version'>>): Promise<AppSettings> {
    return this.enqueue(async () => {
      const current = await this.get()
      const next: AppSettings = {
        ...current,
        ...patch,
        version: 1
      }
      this.settings = next
      await writeJsonAtomic(this.filePath, next)
      return { ...next }
    })
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.queue.then(operation, operation)
    this.queue = next.catch(() => undefined)
    return next
  }
}

function sanitizeSettings(value: unknown): AppSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...DEFAULT_SETTINGS }
  }

  const record = value as Record<string, unknown>
  return {
    version: 1,
    lastTags: Array.isArray(record.lastTags)
      ? record.lastTags.filter((tag): tag is string => typeof tag === 'string').slice(0, 20)
      : [],
    lastReportFolderId: stringOrNull(record.lastReportFolderId),
    lastRosterFolderId: stringOrNull(record.lastRosterFolderId)
  }
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}
