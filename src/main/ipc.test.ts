import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { APP_NAME } from '@shared/app'
import type {
  AppSettings,
  GenerateResponse,
  LibraryFolder,
  LibraryReportItem,
  LibraryRosterItem,
  LibrarySnapshot,
  ProgressEvent,
  ReportData,
  RosterClanLoadResponse,
  RosterSnapshot,
  SaveResponse
} from '@shared/types'
import { IPC_CHANNELS } from '@shared/types'
import { CLAN_TAG, makeAggregationFixture } from './domain/testFixtures'
import { buildFileName } from './export/xlsx'

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
  showSaveDialog: vi.fn(),
  showItemInFolder: vi.fn(),
  openExternal: vi.fn(),
  userData: ''
}))

vi.mock('electron', () => ({
  app: {
    getPath: (name: string) =>
      name === 'documents' ? join(mocks.userData, 'Documents') : mocks.userData,
    getName: () => APP_NAME,
    getVersion: () => '0.1.0'
  },
  dialog: { showSaveDialog: mocks.showSaveDialog },
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => unknown) => {
      mocks.handlers.set(channel, handler)
    }
  },
  shell: {
    showItemInFolder: mocks.showItemInFolder,
    openExternal: mocks.openExternal
  }
}))

import { registerIpcHandlers } from './ipc'

const fixture = makeAggregationFixture()
const tempDirs: string[] = []
let workDir = ''
let savePath = ''

const fakeFetch: typeof fetch = async (input) => {
  const url = new URL(String(input))
  const segments = decodeURIComponent(url.pathname).split('/')
  const tag = segments[3]
  const endpoint = segments[4]

  if (endpoint === 'seasons' && tag === CLAN_TAG) {
    return json({ items: [{ season: '2026-08', state: 'ended' }] })
  }
  if (endpoint === 'group' && tag === CLAN_TAG) {
    return json(fixture.group)
  }
  return new Response('not found', { status: 404 })
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  })
}

function fakeEvent(): {
  sender: { isDestroyed: () => boolean; send: (channel: string, event: ProgressEvent) => void }
} {
  return {
    sender: {
      isDestroyed: () => false,
      send: vi.fn()
    }
  }
}

function handler(channel: string): (...args: unknown[]) => unknown {
  const found = mocks.handlers.get(channel)
  if (!found) throw new Error(`No handler for ${channel}`)
  return found
}

beforeAll(async () => {
  workDir = await mkdtemp(join(tmpdir(), 'raven-ipc-'))
  tempDirs.push(workDir)
  mocks.userData = join(workDir, 'userData')
  savePath = join(workDir, 'exported-report.xlsx')
  vi.stubGlobal('fetch', fakeFetch)
})

beforeEach(() => {
  mocks.handlers.clear()
  mocks.showSaveDialog.mockReset()
  mocks.showItemInFolder.mockReset()
  mocks.openExternal.mockReset()
  registerIpcHandlers()
})

afterAll(async () => {
  vi.unstubAllGlobals()
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('IPC handlers', () => {
  it('generates a report and saves it through the native dialog', async () => {
    const generated = (await handler(IPC_CHANNELS.generate)(fakeEvent(), {
      tags: [CLAN_TAG]
    })) as GenerateResponse

    expect(generated.ok).toBe(true)
    if (!generated.ok) throw new Error(generated.error.message)
    expect(generated.report.players).toHaveLength(3)

    mocks.showSaveDialog.mockResolvedValue({ canceled: false, filePath: savePath })
    const saved = (await handler(IPC_CHANNELS.save)(fakeEvent(), {
      reportId: generated.report.reportId
    })) as SaveResponse

    expect(saved).toEqual({ canceled: false, filePath: savePath })
    expect((await stat(savePath)).size).toBeGreaterThan(1000)
    expect(mocks.showSaveDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultPath: expect.stringContaining(buildFileName(generated.report)),
        filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }]
      })
    )

    const shown = await handler(IPC_CHANNELS.showItem)(fakeEvent(), { filePath: savePath })
    expect(shown).toBe(true)
    expect(mocks.showItemInFolder).toHaveBeenCalledWith(savePath)
  })

  it('returns a cancelled save without writing a file', async () => {
    const generated = (await handler(IPC_CHANNELS.generate)(fakeEvent(), {
      tags: [CLAN_TAG]
    })) as GenerateResponse
    if (!generated.ok) throw new Error(generated.error.message)

    mocks.showSaveDialog.mockResolvedValue({ canceled: true })
    const saved = (await handler(IPC_CHANNELS.save)(fakeEvent(), {
      reportId: generated.report.reportId
    })) as SaveResponse

    expect(saved).toEqual({ canceled: true })
  })

  it('loads a clan and its players for the roster season', async () => {
    const loaded = (await handler(IPC_CHANNELS.rosterLoadClan)(fakeEvent(), {
      tag: '2aaaaaaa',
      seasonKey: '2026-08'
    })) as RosterClanLoadResponse

    expect(loaded.seasonKey).toBe('2026-08')
    expect(loaded.clan).toMatchObject({ tag: CLAN_TAG, name: 'Raven Clan' })
    expect(loaded.players).toHaveLength(3)
  })

  it('returns a friendly error for an invalid roster clan tag', async () => {
    await expect(
      handler(IPC_CHANNELS.rosterLoadClan)(fakeEvent(), {
        tag: 'not a tag!',
        seasonKey: '2026-08'
      })
    ).rejects.toThrow('valid clan tag')
  })

  it('rejects an unknown report id', async () => {
    await expect(
      handler(IPC_CHANNELS.save)(fakeEvent(), { reportId: 'does-not-exist' })
    ).rejects.toThrow('no longer available')
  })

  it('rejects invalid generate input', async () => {
    const generated = (await handler(IPC_CHANNELS.generate)(fakeEvent(), {
      tags: []
    })) as GenerateResponse

    expect(generated).toEqual({
      ok: false,
      error: { code: 'invalid-input', message: 'Add between 1 and 20 valid clan tags.' }
    })
  })

  it('only opens allowlisted external URLs and saved files', async () => {
    expect(
      await handler(IPC_CHANNELS.openExternal)(fakeEvent(), { url: 'https://clashk.ing' })
    ).toBe(true)
    expect(mocks.openExternal).toHaveBeenCalledWith('https://clashk.ing')

    expect(
      await handler(IPC_CHANNELS.openExternal)(fakeEvent(), { url: 'https://example.com' })
    ).toBe(false)

    expect(
      await handler(IPC_CHANNELS.showItem)(fakeEvent(), { filePath: '/etc/passwd' })
    ).toBe(false)
    expect(mocks.showItemInFolder).not.toHaveBeenCalled()
  })

  it('returns app information', async () => {
    const info = await handler(IPC_CHANNELS.appInfo)(fakeEvent())

    expect(info).toMatchObject({
      name: APP_NAME,
      version: '0.1.0',
      cachePath: join(mocks.userData, 'cache', 'clashking'),
      libraryPath: join(mocks.userData, 'library')
    })
  })

  it('remembers the last submitted clan tags', async () => {
    const generated = (await handler(IPC_CHANNELS.generate)(fakeEvent(), {
      tags: [CLAN_TAG]
    })) as GenerateResponse
    expect(generated.ok).toBe(true)

    const settings = (await handler(IPC_CHANNELS.settingsGet)(fakeEvent())) as AppSettings
    expect(settings.lastTags).toEqual([CLAN_TAG])
  })

  it('stores reports and rosters in nested library folders', async () => {
    const generated = (await handler(IPC_CHANNELS.generate)(fakeEvent(), {
      tags: [CLAN_TAG]
    })) as GenerateResponse
    if (!generated.ok) throw new Error(generated.error.message)

    const folder = (await handler(IPC_CHANNELS.libraryCreateFolder)(fakeEvent(), {
      name: 'Season 2026',
      parentId: null
    })) as LibraryFolder
    const child = (await handler(IPC_CHANNELS.libraryCreateFolder)(fakeEvent(), {
      name: 'Week 1',
      parentId: folder.id
    })) as LibraryFolder

    const reportItem = (await handler(IPC_CHANNELS.librarySaveReport)(fakeEvent(), {
      reportId: generated.report.reportId,
      name: 'August report',
      folderId: child.id
    })) as LibraryReportItem
    expect(reportItem).toMatchObject({
      type: 'report',
      folderId: child.id,
      playerCount: generated.report.players.length
    })

    const snapshot = (await handler(IPC_CHANNELS.libraryGet)(fakeEvent())) as LibrarySnapshot
    expect(snapshot.folders.map((candidate) => candidate.name)).toEqual(
      expect.arrayContaining(['Season 2026', 'Week 1'])
    )
    expect(snapshot.items).toContainEqual(reportItem)

    const loaded = (await handler(IPC_CHANNELS.libraryGetReport)(fakeEvent(), {
      id: reportItem.id
    })) as ReportData
    expect(loaded.reportId).toBe(generated.report.reportId)

    const reportExportPath = join(workDir, 'library-report.xlsx')
    mocks.showSaveDialog.mockResolvedValueOnce({ canceled: false, filePath: reportExportPath })
    const reportExport = (await handler(IPC_CHANNELS.libraryExportReport)(fakeEvent(), {
      id: reportItem.id
    })) as SaveResponse
    expect(reportExport).toEqual({ canceled: false, filePath: reportExportPath })
    expect((await stat(reportExportPath)).size).toBeGreaterThan(1000)

    const rosterItem = (await handler(IPC_CHANNELS.librarySaveRoster)(fakeEvent(), {
      name: 'August roster',
      folderId: child.id,
      sourceReportItemId: reportItem.id,
      sourceReportName: reportItem.name,
      seasonLabel: generated.report.seasonLabel,
      players: generated.report.players
    })) as LibraryRosterItem
    expect(rosterItem).toMatchObject({
      type: 'roster',
      folderId: child.id,
      playerCount: generated.report.players.length
    })

    const roster = (await handler(IPC_CHANNELS.libraryGetRoster)(fakeEvent(), {
      id: rosterItem.id
    })) as RosterSnapshot
    expect(roster.players).toEqual(generated.report.players)

    const rosterExportPath = join(workDir, 'library-roster.xlsx')
    mocks.showSaveDialog.mockResolvedValueOnce({ canceled: false, filePath: rosterExportPath })
    const rosterExport = (await handler(IPC_CHANNELS.libraryExportRoster)(fakeEvent(), {
      id: rosterItem.id,
      name: rosterItem.name,
      folderId: rosterItem.folderId,
      sourceReportItemId: rosterItem.sourceReportItemId,
      sourceReportName: rosterItem.sourceReportName,
      seasonLabel: rosterItem.seasonLabel,
      players: roster.players
    })) as SaveResponse
    expect(rosterExport).toEqual({ canceled: false, filePath: rosterExportPath })
    expect((await stat(rosterExportPath)).size).toBeGreaterThan(1000)

    const settings = (await handler(IPC_CHANNELS.settingsGet)(fakeEvent())) as AppSettings
    expect(settings.lastReportFolderId).toBe(child.id)
    expect(settings.lastRosterFolderId).toBe(child.id)
  })

  it('renames, reorders and deletes library folders', async () => {
    const parent = (await handler(IPC_CHANNELS.libraryCreateFolder)(fakeEvent(), {
      name: 'Parent',
      parentId: null
    })) as LibraryFolder
    const child = (await handler(IPC_CHANNELS.libraryCreateFolder)(fakeEvent(), {
      name: 'Child',
      parentId: parent.id
    })) as LibraryFolder

    const renamed = (await handler(IPC_CHANNELS.libraryRenameFolder)(fakeEvent(), {
      id: parent.id,
      name: 'Renamed parent'
    })) as LibraryFolder
    expect(renamed.name).toBe('Renamed parent')

    expect(
      await handler(IPC_CHANNELS.libraryMoveFolder)(fakeEvent(), {
        id: child.id,
        parentId: null,
        index: 0
      })
    ).toBe(true)

    const snapshot = (await handler(IPC_CHANNELS.libraryGet)(fakeEvent())) as LibrarySnapshot
    expect(snapshot.folders.find((folder) => folder.id === child.id)?.parentId).toBeNull()

    expect(
      await handler(IPC_CHANNELS.libraryDeleteFolder)(fakeEvent(), { id: parent.id })
    ).toBe(true)
    const afterDelete = (await handler(IPC_CHANNELS.libraryGet)(fakeEvent())) as LibrarySnapshot
    expect(afterDelete.folders.some((folder) => folder.id === parent.id)).toBe(false)
    expect(afterDelete.folders.some((folder) => folder.id === child.id)).toBe(true)
  })
})
