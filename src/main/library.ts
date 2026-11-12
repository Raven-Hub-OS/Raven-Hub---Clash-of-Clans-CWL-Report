import { randomUUID } from 'node:crypto'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import type {
  LibraryFolder,
  LibraryItem,
  LibraryReportItem,
  LibraryRosterItem,
  LibrarySnapshot,
  ReportData,
  RosterDraft,
  RosterSnapshot
} from '@shared/types'
import { readJsonFile, writeJsonAtomic } from './storage/jsonFile'

const LIBRARY_VERSION = 1 as const
const MAX_FOLDER_NAME = 80
const MAX_ITEM_NAME = 120

interface LibraryIndex {
  version: typeof LIBRARY_VERSION
  folders: LibraryFolder[]
  items: LibraryItem[]
}

interface StoredReport {
  version: 1
  savedAt: string
  report: ReportData
}

export class LibraryError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'LibraryError'
  }
}

export class LibraryService {
  private index: LibraryIndex | null = null
  private loadPromise: Promise<void> | null = null
  private queue: Promise<unknown> = Promise.resolve()
  private readonly indexPath: string
  private readonly reportsDir: string
  private readonly rostersDir: string

  constructor(private readonly rootDir: string) {
    this.indexPath = join(rootDir, 'library.json')
    this.reportsDir = join(rootDir, 'reports')
    this.rostersDir = join(rootDir, 'rosters')
  }

  async getSnapshot(): Promise<LibrarySnapshot> {
    await this.ensureLoaded()
    await this.queue.catch(() => undefined)
    return {
      folders: this.folders().map((folder) => ({ ...folder })),
      items: this.items().map((item) => ({ ...item }))
    }
  }

  async createFolder(name: string, parentId: string | null): Promise<LibraryFolder> {
    return this.enqueue(async () => {
      await this.ensureLoaded()
      const cleanName = cleanFolderName(name)
      const parent = this.requireFolder(parentId)
      const now = new Date().toISOString()
      const folder: LibraryFolder = {
        id: randomUUID(),
        name: cleanName,
        parentId: parent?.id ?? null,
        order: this.nextFolderOrder(parent?.id ?? null),
        createdAt: now,
        updatedAt: now
      }
      this.index!.folders.push(folder)
      await this.persist()
      return { ...folder }
    })
  }

  async renameFolder(folderId: string, name: string): Promise<LibraryFolder> {
    return this.enqueue(async () => {
      await this.ensureLoaded()
      const folder = this.requireFolder(folderId)
      if (!folder) throw new LibraryError('not-found', 'Folder not found.')
      folder.name = cleanFolderName(name)
      folder.updatedAt = new Date().toISOString()
      await this.persist()
      return { ...folder }
    })
  }

  async deleteFolder(folderId: string): Promise<boolean> {
    return this.enqueue(async () => {
      await this.ensureLoaded()
      const folder = this.requireFolder(folderId)
      if (!folder) throw new LibraryError('not-found', 'Folder not found.')

      const folderIds = this.descendantFolderIds(folderId)
      const removedItems = this.index!.items.filter(
        (item) => item.folderId !== null && folderIds.has(item.folderId)
      )

      await Promise.all(removedItems.map((item) => this.removeItemFile(item)))
      this.index!.items = this.index!.items.filter((item) => !removedItems.includes(item))
      this.index!.folders = this.index!.folders.filter((candidate) => !folderIds.has(candidate.id))
      this.normalizeFolderOrders(folder.parentId)
      await this.persist()
      return true
    })
  }

  async moveFolder(
    folderId: string,
    parentId: string | null,
    index: number
  ): Promise<boolean> {
    return this.enqueue(async () => {
      await this.ensureLoaded()
      const folder = this.requireFolder(folderId)
      if (!folder) throw new LibraryError('not-found', 'Folder not found.')
      const parent = this.requireFolder(parentId)

      if (parent && (parent.id === folder.id || this.isDescendant(parent.id, folder.id))) {
        throw new LibraryError('invalid-move', 'A folder cannot be moved into itself or a child.')
      }

      const oldParentId = folder.parentId
      folder.parentId = parent?.id ?? null
      folder.updatedAt = new Date().toISOString()
      this.moveInGroup(
        this.folders().filter((candidate) => candidate.parentId === folder.parentId),
        folder,
        index
      )
      this.normalizeFolderOrders(oldParentId)
      this.normalizeFolderOrders(folder.parentId)
      await this.persist()
      return true
    })
  }

  async renameItem(itemId: string, name: string): Promise<LibraryItem> {
    return this.enqueue(async () => {
      await this.ensureLoaded()
      const item = this.requireItem(itemId)
      if (!item) throw new LibraryError('not-found', 'Item not found.')
      item.name = cleanItemName(name)
      item.updatedAt = new Date().toISOString()

      if (item.type === 'roster') {
        const roster = await this.readRosterFile(item.id)
        if (roster) {
          roster.name = item.name
          roster.updatedAt = item.updatedAt
          await this.writeRosterFile(item.id, roster)
        }
      }

      await this.persist()
      return { ...item }
    })
  }

  async moveItem(itemId: string, folderId: string | null, index: number): Promise<boolean> {
    return this.enqueue(async () => {
      await this.ensureLoaded()
      const item = this.requireItem(itemId)
      if (!item) throw new LibraryError('not-found', 'Item not found.')
      const folder = this.requireFolder(folderId)

      const oldFolderId = item.folderId
      item.folderId = folder?.id ?? null
      item.updatedAt = new Date().toISOString()
      this.moveInGroup(
        this.items().filter((candidate) => candidate.folderId === item.folderId),
        item,
        index
      )
      this.normalizeItemOrders(oldFolderId)
      this.normalizeItemOrders(item.folderId)
      await this.persist()
      return true
    })
  }

  async deleteItem(itemId: string): Promise<boolean> {
    return this.enqueue(async () => {
      await this.ensureLoaded()
      const item = this.requireItem(itemId)
      if (!item) throw new LibraryError('not-found', 'Item not found.')

      await this.removeItemFile(item)
      const folderId = item.folderId
      this.index!.items = this.index!.items.filter((candidate) => candidate.id !== item.id)
      this.normalizeItemOrders(folderId)
      await this.persist()
      return true
    })
  }

  async saveReport(report: ReportData, name: string, folderId: string | null): Promise<LibraryReportItem> {
    return this.enqueue(async () => {
      await this.ensureLoaded()
      const cleanName = cleanItemName(name)
      const folder = this.requireFolder(folderId)
      const now = new Date().toISOString()

      let item = this.items().find(
        (candidate): candidate is LibraryReportItem =>
          candidate.type === 'report' && candidate.reportId === report.reportId
      )

      if (item) {
        const oldFolderId = item.folderId
        item.name = cleanName
        item.folderId = folder?.id ?? null
        item.updatedAt = now
        item.seasonLabel = report.seasonLabel
        item.clanCount = report.clans.length
        item.playerCount = report.players.length
        this.moveInGroup(
          this.items().filter((candidate) => candidate.folderId === item!.folderId),
          item,
          Number.POSITIVE_INFINITY
        )
        this.normalizeItemOrders(oldFolderId)
        this.normalizeItemOrders(item.folderId)
      } else {
        item = {
          id: randomUUID(),
          type: 'report',
          name: cleanName,
          folderId: folder?.id ?? null,
          order: this.nextItemOrder(folder?.id ?? null),
          reportId: report.reportId,
          seasonLabel: report.seasonLabel,
          clanCount: report.clans.length,
          playerCount: report.players.length,
          createdAt: now,
          updatedAt: now
        }
        this.index!.items.push(item)
      }

      const stored: StoredReport = {
        version: 1,
        savedAt: now,
        report
      }
      await writeJsonAtomic(this.reportPath(item.id), stored)
      await this.persist()
      return { ...item }
    })
  }

  async getReport(itemId: string): Promise<ReportData> {
    await this.ensureLoaded()
    await this.queue.catch(() => undefined)
    const item = this.requireItem(itemId)
    if (!item || item.type !== 'report') {
      throw new LibraryError('not-found', 'Saved report not found.')
    }

    const stored = await readJsonFile<StoredReport | null>(this.reportPath(item.id), null)
    if (!stored || !stored.report || !Array.isArray(stored.report.players)) {
      throw new LibraryError('invalid-data', 'The saved report file is missing or corrupted.')
    }
    return stored.report
  }

  async saveRoster(draft: RosterDraft): Promise<LibraryRosterItem> {
    return this.enqueue(async () => {
      await this.ensureLoaded()
      const cleanName = cleanItemName(draft.name)
      const folder = this.requireFolder(draft.folderId)
      const now = new Date().toISOString()

      let item = draft.id
        ? this.items().find(
            (candidate): candidate is LibraryRosterItem =>
              candidate.type === 'roster' && candidate.id === draft.id
          )
        : undefined

      if (item) {
        const oldFolderId = item.folderId
        item.name = cleanName
        item.folderId = folder?.id ?? null
        item.updatedAt = now
        item.sourceReportItemId = draft.sourceReportItemId
        item.sourceReportName = draft.sourceReportName
        item.seasonLabel = draft.seasonLabel
        item.playerCount = draft.players.length
        this.moveInGroup(
          this.items().filter((candidate) => candidate.folderId === item!.folderId),
          item,
          Number.POSITIVE_INFINITY
        )
        this.normalizeItemOrders(oldFolderId)
        this.normalizeItemOrders(item.folderId)
      } else {
        item = {
          id: randomUUID(),
          type: 'roster',
          name: cleanName,
          folderId: folder?.id ?? null,
          order: this.nextItemOrder(folder?.id ?? null),
          sourceReportItemId: draft.sourceReportItemId,
          sourceReportName: draft.sourceReportName,
          seasonLabel: draft.seasonLabel,
          playerCount: draft.players.length,
          createdAt: now,
          updatedAt: now
        }
        this.index!.items.push(item)
      }

      const snapshot: RosterSnapshot = {
        version: 1,
        id: item.id,
        name: item.name,
        sourceReportItemId: item.sourceReportItemId,
        sourceReportName: item.sourceReportName,
        seasonLabel: item.seasonLabel,
        seasonKey: draft.seasonKey ?? null,
        clans: draft.clans ?? [],
        extraPlayers: draft.extraPlayers ?? [],
        players: draft.players,
        createdAt: item.createdAt,
        updatedAt: now
      }
      await writeJsonAtomic(this.rosterPath(item.id), snapshot)
      await this.persist()
      return { ...item }
    })
  }

  async getRoster(itemId: string): Promise<RosterSnapshot> {
    await this.ensureLoaded()
    await this.queue.catch(() => undefined)
    const item = this.requireItem(itemId)
    if (!item || item.type !== 'roster') {
      throw new LibraryError('not-found', 'Saved roster not found.')
    }

    const roster = await this.readRosterFile(item.id)
    if (!roster || !Array.isArray(roster.players)) {
      throw new LibraryError('invalid-data', 'The saved roster file is missing or corrupted.')
    }

    // Rosters saved before clans/extra players existed only include `players`.
    return {
      ...roster,
      seasonKey: typeof roster.seasonKey === 'string' ? roster.seasonKey : null,
      clans: Array.isArray(roster.clans) ? roster.clans : [],
      extraPlayers: Array.isArray(roster.extraPlayers) ? roster.extraPlayers : []
    }
  }

  private async ensureLoaded(): Promise<void> {
    if (!this.loadPromise) this.loadPromise = this.load()
    return this.loadPromise
  }

  private async load(): Promise<void> {
    const raw = await readJsonFile<unknown>(this.indexPath, null)
    this.index = sanitizeIndex(raw)
  }

  private folders(): LibraryFolder[] {
    return this.index!.folders
  }

  private items(): LibraryItem[] {
    return this.index!.items
  }

  private requireFolder(folderId: string | null): LibraryFolder | null {
    if (!folderId) return null
    const folder = this.folders().find((candidate) => candidate.id === folderId)
    if (!folder) throw new LibraryError('not-found', 'Folder not found.')
    return folder
  }

  private requireItem(itemId: string): LibraryItem | undefined {
    return this.items().find((candidate) => candidate.id === itemId)
  }

  private nextFolderOrder(parentId: string | null): number {
    const siblings = this.folders().filter((folder) => folder.parentId === parentId)
    return siblings.reduce((max, folder) => Math.max(max, folder.order + 1), 0)
  }

  private nextItemOrder(folderId: string | null): number {
    const siblings = this.items().filter((item) => item.folderId === folderId)
    return siblings.reduce((max, item) => Math.max(max, item.order + 1), 0)
  }

  private moveInGroup<T extends { order: number }>(group: T[], item: T, index: number): void {
    const sorted = group.filter((candidate) => candidate !== item).sort((a, b) => a.order - b.order)
    const target = Number.isFinite(index) ? Math.max(0, Math.min(index, sorted.length)) : sorted.length
    sorted.splice(target, 0, item)
    sorted.forEach((candidate, position) => {
      candidate.order = position
    })
  }

  private normalizeFolderOrders(parentId: string | null): void {
    this.folders()
      .filter((folder) => folder.parentId === parentId)
      .sort((a, b) => a.order - b.order)
      .forEach((folder, index) => {
        folder.order = index
      })
  }

  private normalizeItemOrders(folderId: string | null): void {
    this.items()
      .filter((item) => item.folderId === folderId)
      .sort((a, b) => a.order - b.order)
      .forEach((item, index) => {
        item.order = index
      })
  }

  private descendantFolderIds(folderId: string): Set<string> {
    const ids = new Set<string>([folderId])
    let changed = true
    while (changed) {
      changed = false
      for (const folder of this.folders()) {
        if (folder.parentId && ids.has(folder.parentId) && !ids.has(folder.id)) {
          ids.add(folder.id)
          changed = true
        }
      }
    }
    return ids
  }

  private isDescendant(folderId: string, ancestorId: string): boolean {
    let current = this.folders().find((folder) => folder.id === folderId)
    while (current?.parentId) {
      if (current.parentId === ancestorId) return true
      current = this.folders().find((folder) => folder.id === current?.parentId)
    }
    return false
  }

  private reportPath(itemId: string): string {
    return join(this.reportsDir, `${itemId}.json`)
  }

  private rosterPath(itemId: string): string {
    return join(this.rostersDir, `${itemId}.json`)
  }

  private async readRosterFile(itemId: string): Promise<RosterSnapshot | null> {
    return readJsonFile<RosterSnapshot | null>(this.rosterPath(itemId), null)
  }

  private async writeRosterFile(itemId: string, roster: RosterSnapshot): Promise<void> {
    await writeJsonAtomic(this.rosterPath(itemId), roster)
  }

  private async removeItemFile(item: LibraryItem): Promise<void> {
    const path = item.type === 'report' ? this.reportPath(item.id) : this.rosterPath(item.id)
    await rm(path, { force: true })
  }

  private async persist(): Promise<void> {
    await writeJsonAtomic(this.indexPath, this.index)
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.queue.then(operation, operation)
    this.queue = next.catch(() => undefined)
    return next
  }
}

function sanitizeIndex(value: unknown): LibraryIndex {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { version: LIBRARY_VERSION, folders: [], items: [] }
  }

  const record = value as Record<string, unknown>
  const seenFolderIds = new Set<string>()
  const folders = Array.isArray(record.folders)
    ? record.folders
        .map(sanitizeFolder)
        .filter((folder): folder is LibraryFolder => {
          if (!folder || seenFolderIds.has(folder.id)) return false
          seenFolderIds.add(folder.id)
          return true
        })
    : []
  const folderIds = new Set(folders.map((folder) => folder.id))

  for (const folder of folders) {
    if (folder.parentId && !folderIds.has(folder.parentId)) folder.parentId = null
  }

  // A corrupted index can contain a parent cycle. Break it at the first repeated
  // ancestor so the renderer's recursive folder tree always terminates.
  const foldersById = new Map(folders.map((folder) => [folder.id, folder]))
  for (const folder of folders) {
    const seen = new Set<string>([folder.id])
    let parentId = folder.parentId
    while (parentId) {
      if (seen.has(parentId)) {
        folder.parentId = null
        break
      }
      seen.add(parentId)
      parentId = foldersById.get(parentId)?.parentId ?? null
    }
  }

  const seenItemIds = new Set<string>()
  const items = Array.isArray(record.items)
    ? record.items
        .map(sanitizeItem)
        .filter((item): item is LibraryItem => {
          if (!item || seenItemIds.has(item.id)) return false
          seenItemIds.add(item.id)
          return true
        })
        .map((item) => {
          if (item.folderId && !folderIds.has(item.folderId)) item.folderId = null
          return item
        })
    : []

  return { version: LIBRARY_VERSION, folders, items }
}

function sanitizeFolder(value: unknown): LibraryFolder | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  if (typeof record.id !== 'string' || typeof record.name !== 'string') return null
  return {
    id: record.id,
    name: record.name,
    parentId: typeof record.parentId === 'string' ? record.parentId : null,
    order: finiteOrder(record.order),
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : new Date(0).toISOString(),
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : new Date(0).toISOString()
  }
}

function sanitizeItem(value: unknown): LibraryItem | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  if (typeof record.id !== 'string' || typeof record.name !== 'string') return null
  if (record.type !== 'report' && record.type !== 'roster') return null

  const base = {
    id: record.id,
    name: record.name,
    folderId: typeof record.folderId === 'string' ? record.folderId : null,
    order: finiteOrder(record.order),
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : new Date(0).toISOString(),
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : new Date(0).toISOString()
  }

  if (record.type === 'report') {
    return {
      ...base,
      type: 'report',
      reportId: typeof record.reportId === 'string' ? record.reportId : base.id,
      seasonLabel: typeof record.seasonLabel === 'string' ? record.seasonLabel : '',
      clanCount: finiteCount(record.clanCount),
      playerCount: finiteCount(record.playerCount)
    }
  }

  return {
    ...base,
    type: 'roster',
    sourceReportItemId:
      typeof record.sourceReportItemId === 'string' ? record.sourceReportItemId : null,
    sourceReportName: typeof record.sourceReportName === 'string' ? record.sourceReportName : '',
    seasonLabel: typeof record.seasonLabel === 'string' ? record.seasonLabel : '',
    playerCount: finiteCount(record.playerCount)
  }
}

function finiteOrder(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function finiteCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0
}

function cleanFolderName(value: string): string {
  const name = value.trim()
  if (!name) throw new LibraryError('invalid-name', 'Enter a folder name.')
  if (name.length > MAX_FOLDER_NAME) {
    throw new LibraryError('invalid-name', `Folder names are limited to ${MAX_FOLDER_NAME} characters.`)
  }
  return name
}

function cleanItemName(value: string): string {
  const name = value.trim()
  if (!name) throw new LibraryError('invalid-name', 'Enter a name.')
  if (name.length > MAX_ITEM_NAME) {
    throw new LibraryError('invalid-name', `Names are limited to ${MAX_ITEM_NAME} characters.`)
  }
  return name
}
