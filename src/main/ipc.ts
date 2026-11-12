import { app, dialog, ipcMain, shell, type IpcMainInvokeEvent } from 'electron'
import { join } from 'node:path'
import { z } from 'zod'
import {
  IPC_CHANNELS,
  MAX_CLANS,
  type AppInfo,
  type GenerateResponse,
  type ProgressEvent,
  type ReportData,
  type RosterDraft,
  type SaveResponse
} from '@shared/types'
import { APP_NAME } from '@shared/app'
import { normalizeTag } from '@shared/tags'
import { ClashKingClient, ClashKingError } from './clashking/client'
import { generateReport, ReportError } from './domain/report'
import { loadRosterClan, RosterClanError } from './domain/rosterClan'
import { buildFileName, writeWorkbookToFile } from './export/xlsx'
import { buildRosterFileName, writeRosterToFile } from './export/rosterXlsx'
import { isAllowedExternalUrl } from './external'
import { LibraryService } from './library'
import { FolderNameSchema, IdSchema, LibraryNameSchema, RosterDraftSchema } from './librarySchemas'
import { SettingsStore } from './settings'

const GenerateSchema = z.object({
  tags: z.array(z.string()).min(1).max(MAX_CLANS)
})

const SaveSchema = z.object({
  reportId: z.string().min(1)
})

const OpenExternalSchema = z.object({
  url: z.string().url()
})

const ShowItemSchema = z.object({
  filePath: z.string().min(1)
})

const CreateFolderSchema = z.object({
  name: z.string(),
  parentId: IdSchema.nullable()
})

const RenameFolderSchema = z.object({
  id: IdSchema,
  name: z.string()
})

const DeleteFolderSchema = z.object({
  id: IdSchema
})

const MoveFolderSchema = z.object({
  id: IdSchema,
  parentId: IdSchema.nullable(),
  index: z.number().int().min(0).max(100_000)
})

const RenameItemSchema = z.object({
  id: IdSchema,
  name: z.string()
})

const MoveItemSchema = z.object({
  id: IdSchema,
  folderId: IdSchema.nullable(),
  index: z.number().int().min(0).max(100_000)
})

const DeleteItemSchema = z.object({
  id: IdSchema
})

const SaveReportSchema = z.object({
  reportId: z.string().min(1),
  name: z.string(),
  folderId: IdSchema.nullable()
})

const GetLibraryItemSchema = z.object({
  id: IdSchema
})

const LoadRosterClanSchema = z.object({
  tag: z.string().trim().min(1).max(20),
  seasonKey: z.string().trim().max(20).nullable().optional()
})

const SettingsLastFolderSchema = z.object({
  kind: z.enum(['report', 'roster']),
  folderId: IdSchema.nullable()
})

interface ActiveJob {
  controller: AbortController
}

export function registerIpcHandlers(): void {
  const userData = app.getPath('userData')
  const cacheDir = join(userData, 'cache', 'clashking')
  const libraryDir = join(userData, 'library')
  const client = new ClashKingClient({ cacheDir })
  const settings = new SettingsStore(join(userData, 'settings.json'))
  const library = new LibraryService(libraryDir)
  const reports = new Map<string, ReportData>()
  const savedPaths = new Set<string>()
  let activeJob: ActiveJob | null = null

  ipcMain.handle(
    IPC_CHANNELS.generate,
    async (event: IpcMainInvokeEvent, raw: unknown): Promise<GenerateResponse> => {
      const parsed = GenerateSchema.safeParse(raw)
      if (!parsed.success) {
        return {
          ok: false,
          error: { code: 'invalid-input', message: 'Add between 1 and 20 valid clan tags.' }
        }
      }

      const tags = [
        ...new Set(
          parsed.data.tags.map((tag) => normalizeTag(tag)).filter((tag): tag is string => !!tag)
        )
      ]

      if (tags.length === 0) {
        return {
          ok: false,
          error: { code: 'invalid-input', message: 'Add at least one valid clan tag.' }
        }
      }

      if (activeJob) {
        return {
          ok: false,
          error: {
            code: 'busy',
            message: 'A report is already being generated. Cancel it before starting another.'
          }
        }
      }

      await settings.update({ lastTags: tags }).catch((error: unknown) => {
        console.error('Could not save the last submitted tags:', error)
      })

      const controller = new AbortController()
      activeJob = { controller }

      try {
        const report = await generateReport({
          tags,
          client,
          signal: controller.signal,
          onProgress: (progress) => sendProgress(event, progress)
        })

        reports.set(report.reportId, report)
        while (reports.size > 5) {
          const oldest = reports.keys().next().value
          if (!oldest) break
          reports.delete(oldest)
        }

        return { ok: true, report }
      } catch (error) {
        return { ok: false, error: serializeError(error) }
      } finally {
        if (activeJob?.controller === controller) activeJob = null
      }
    }
  )

  ipcMain.handle(IPC_CHANNELS.cancel, () => {
    activeJob?.controller.abort()
    return true
  })

  ipcMain.handle(
    IPC_CHANNELS.save,
    async (_event, raw: unknown): Promise<SaveResponse> => {
      const parsed = SaveSchema.safeParse(raw)
      if (!parsed.success) throw new Error('Invalid report request.')

      const report = reports.get(parsed.data.reportId)
      if (!report) {
        throw new Error('This report is no longer available. Generate it again.')
      }

      const result = await dialog.showSaveDialog({
        title: 'Save CWL report',
        defaultPath: join(app.getPath('documents'), buildFileName(report)),
        filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }]
      })

      if (result.canceled || !result.filePath) return { canceled: true }

      await writeWorkbookToFile(report, result.filePath)
      savedPaths.add(result.filePath)
      return { canceled: false, filePath: result.filePath }
    }
  )

  ipcMain.handle(IPC_CHANNELS.showItem, (_event, raw: unknown) => {
    const parsed = ShowItemSchema.safeParse(raw)
    if (!parsed.success || !savedPaths.has(parsed.data.filePath)) return false
    shell.showItemInFolder(parsed.data.filePath)
    return true
  })

  ipcMain.handle(IPC_CHANNELS.openExternal, async (_event, raw: unknown) => {
    const parsed = OpenExternalSchema.safeParse(raw)
    if (!parsed.success || !isAllowedExternalUrl(parsed.data.url)) return false
    await shell.openExternal(parsed.data.url)
    return true
  })

  ipcMain.handle(IPC_CHANNELS.appInfo, (): AppInfo => {
    return {
      name: APP_NAME,
      version: app.getVersion(),
      platform: process.platform,
      cachePath: cacheDir,
      libraryPath: libraryDir
    }
  })

  ipcMain.handle(IPC_CHANNELS.settingsGet, () => settings.get())

  ipcMain.handle(IPC_CHANNELS.settingsSetLastFolder, async (_event, raw: unknown) => {
    const parsed = SettingsLastFolderSchema.parse(raw)
    return settings.update(
      parsed.kind === 'report'
        ? { lastReportFolderId: parsed.folderId }
        : { lastRosterFolderId: parsed.folderId }
    )
  })

  ipcMain.handle(IPC_CHANNELS.libraryGet, () => library.getSnapshot())

  ipcMain.handle(IPC_CHANNELS.libraryCreateFolder, (_event, raw: unknown) => {
    const parsed = CreateFolderSchema.extend({ name: FolderNameSchema }).parse(raw)
    return library.createFolder(parsed.name, parsed.parentId)
  })

  ipcMain.handle(IPC_CHANNELS.libraryRenameFolder, (_event, raw: unknown) => {
    const parsed = RenameFolderSchema.extend({ name: FolderNameSchema }).parse(raw)
    return library.renameFolder(parsed.id, parsed.name)
  })

  ipcMain.handle(IPC_CHANNELS.libraryDeleteFolder, (_event, raw: unknown) => {
    const parsed = DeleteFolderSchema.parse(raw)
    return library.deleteFolder(parsed.id)
  })

  ipcMain.handle(IPC_CHANNELS.libraryMoveFolder, (_event, raw: unknown) => {
    const parsed = MoveFolderSchema.parse(raw)
    return library.moveFolder(parsed.id, parsed.parentId, parsed.index)
  })

  ipcMain.handle(IPC_CHANNELS.libraryRenameItem, (_event, raw: unknown) => {
    const parsed = RenameItemSchema.extend({ name: LibraryNameSchema }).parse(raw)
    return library.renameItem(parsed.id, parsed.name)
  })

  ipcMain.handle(IPC_CHANNELS.libraryMoveItem, (_event, raw: unknown) => {
    const parsed = MoveItemSchema.parse(raw)
    return library.moveItem(parsed.id, parsed.folderId, parsed.index)
  })

  ipcMain.handle(IPC_CHANNELS.libraryDeleteItem, (_event, raw: unknown) => {
    const parsed = DeleteItemSchema.parse(raw)
    return library.deleteItem(parsed.id)
  })

  ipcMain.handle(IPC_CHANNELS.librarySaveReport, async (_event, raw: unknown) => {
    const parsed = SaveReportSchema.extend({ name: LibraryNameSchema }).parse(raw)
    const report = reports.get(parsed.reportId)
    if (!report) {
      throw new Error('This report is no longer available. Generate it again.')
    }

    const item = await library.saveReport(report, parsed.name, parsed.folderId)
    await settings
      .update({ lastReportFolderId: parsed.folderId })
      .catch((error: unknown) => console.error('Could not remember the report folder:', error))
    return item
  })

  ipcMain.handle(IPC_CHANNELS.libraryGetReport, (_event, raw: unknown) => {
    const parsed = GetLibraryItemSchema.parse(raw)
    return library.getReport(parsed.id)
  })

  ipcMain.handle(
    IPC_CHANNELS.libraryExportReport,
    async (_event, raw: unknown): Promise<SaveResponse> => {
      const parsed = GetLibraryItemSchema.parse(raw)
      const report = await library.getReport(parsed.id)

      const result = await dialog.showSaveDialog({
        title: 'Export CWL report',
        defaultPath: join(app.getPath('documents'), buildFileName(report)),
        filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }]
      })

      if (result.canceled || !result.filePath) return { canceled: true }

      await writeWorkbookToFile(report, result.filePath)
      savedPaths.add(result.filePath)
      return { canceled: false, filePath: result.filePath }
    }
  )

  ipcMain.handle(IPC_CHANNELS.librarySaveRoster, async (_event, raw: unknown) => {
    const draft = RosterDraftSchema.parse(raw)
    const item = await library.saveRoster(draft)
    await settings
      .update({ lastRosterFolderId: draft.folderId })
      .catch((error: unknown) => console.error('Could not remember the roster folder:', error))
    return item
  })

  ipcMain.handle(IPC_CHANNELS.libraryGetRoster, (_event, raw: unknown) => {
    const parsed = GetLibraryItemSchema.parse(raw)
    return library.getRoster(parsed.id)
  })

  ipcMain.handle(IPC_CHANNELS.rosterLoadClan, async (_event, raw: unknown) => {
    const parsed = LoadRosterClanSchema.parse(raw)
    try {
      return await loadRosterClan({
        tag: parsed.tag,
        seasonKey: parsed.seasonKey ?? null,
        client
      })
    } catch (error) {
      if (error instanceof RosterClanError) throw new Error(error.message)
      throw error
    }
  })

  ipcMain.handle(
    IPC_CHANNELS.libraryExportRoster,
    async (_event, raw: unknown): Promise<SaveResponse> => {
      const draft: RosterDraft = RosterDraftSchema.parse(raw)

      const result = await dialog.showSaveDialog({
        title: 'Export CWL roster',
        defaultPath: join(
          app.getPath('documents'),
          buildRosterFileName({
            seasonLabel: draft.seasonLabel,
            players: draft.players
          })
        ),
        filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }]
      })

      if (result.canceled || !result.filePath) return { canceled: true }

      await writeRosterToFile(
        {
          name: draft.name,
          seasonLabel: draft.seasonLabel,
          sourceReportName: draft.sourceReportName,
          clans: draft.clans ?? [],
          players: draft.players
        },
        result.filePath
      )
      savedPaths.add(result.filePath)
      return { canceled: false, filePath: result.filePath }
    }
  )
}

function sendProgress(event: IpcMainInvokeEvent, progress: ProgressEvent): void {
  if (!event.sender.isDestroyed()) {
    event.sender.send(IPC_CHANNELS.progress, progress)
  }
}

function serializeError(error: unknown): { code: string; message: string } {
  if (error instanceof ReportError) {
    return { code: error.code, message: error.message }
  }
  if (error instanceof ClashKingError) {
    if (error.code === 'cancelled') {
      return { code: 'cancelled', message: 'Report generation was cancelled.' }
    }
    return { code: error.code, message: error.message }
  }
  if (error instanceof Error) {
    console.error('Unexpected report error:', error)
    return {
      code: 'unexpected',
      message: 'Something went wrong while building the report. Please try again.'
    }
  }
  return { code: 'unexpected', message: 'Something went wrong while building the report.' }
}
