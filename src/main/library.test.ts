import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { RosterDraft } from '@shared/types'
import { LibraryService } from './library'
import { makeReport } from './domain/testFixtures'

const tempDirs: string[] = []

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'raven-library-'))
  tempDirs.push(dir)
  return dir
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('LibraryService folders', () => {
  it('creates nested folders and persists them', async () => {
    const dir = await makeTempDir()
    const service = new LibraryService(dir)

    const season = await service.createFolder('Season 2026', null)
    const archive = await service.createFolder('Archive', null)
    const week = await service.createFolder('Week 1', season.id)

    expect(season.order).toBe(0)
    expect(archive.order).toBe(1)
    expect(week.parentId).toBe(season.id)
    expect(week.order).toBe(0)

    const snapshot = await new LibraryService(dir).getSnapshot()
    expect(snapshot.folders).toHaveLength(3)
    expect(snapshot.folders.find((folder) => folder.id === week.id)?.parentId).toBe(season.id)
  })

  it('reorders siblings and reparents folders', async () => {
    const service = new LibraryService(await makeTempDir())
    const alpha = await service.createFolder('Alpha', null)
    const bravo = await service.createFolder('Bravo', null)
    const charlie = await service.createFolder('Charlie', null)

    await service.moveFolder(charlie.id, null, 0)
    let snapshot = await service.getSnapshot()
    let rootOrder = snapshot.folders
      .filter((folder) => folder.parentId === null)
      .sort((a, b) => a.order - b.order)
      .map((folder) => folder.name)
    expect(rootOrder).toEqual(['Charlie', 'Alpha', 'Bravo'])

    await service.moveFolder(bravo.id, alpha.id, 0)
    snapshot = await service.getSnapshot()
    expect(snapshot.folders.find((folder) => folder.id === bravo.id)?.parentId).toBe(alpha.id)
    expect(
      snapshot.folders
        .filter((folder) => folder.parentId === alpha.id)
        .map((folder) => folder.name)
    ).toEqual(['Bravo'])
  })

  it('rejects moving a folder into itself or one of its children', async () => {
    const service = new LibraryService(await makeTempDir())
    const parent = await service.createFolder('Parent', null)
    const child = await service.createFolder('Child', parent.id)

    await expect(service.moveFolder(parent.id, parent.id, 0)).rejects.toThrow(
      'cannot be moved into itself'
    )
    await expect(service.moveFolder(parent.id, child.id, 0)).rejects.toThrow(
      'cannot be moved into itself'
    )
  })

  it('renames folders and rejects empty names', async () => {
    const service = new LibraryService(await makeTempDir())
    const folder = await service.createFolder('Old name', null)

    await expect(service.renameFolder(folder.id, '   ')).rejects.toThrow('Enter a folder name')
    await expect(service.renameFolder(folder.id, 'New name')).resolves.toMatchObject({
      name: 'New name'
    })
  })
})

describe('LibraryService reports', () => {
  it('saves and reads a report snapshot', async () => {
    const service = new LibraryService(await makeTempDir())
    const report = makeReport()
    const folder = await service.createFolder('August', null)

    const item = await service.saveReport(report, 'August report', folder.id)

    expect(item).toMatchObject({
      type: 'report',
      name: 'August report',
      folderId: folder.id,
      reportId: report.reportId,
      seasonLabel: report.seasonLabel,
      clanCount: report.clans.length,
      playerCount: report.players.length
    })
    await expect(service.getReport(item.id)).resolves.toEqual(report)
  })

  it('updates the existing item when the same report is saved again', async () => {
    const service = new LibraryService(await makeTempDir())
    const report = makeReport()

    const first = await service.saveReport(report, 'First name', null)
    const second = await service.saveReport({ ...report, seasonLabel: 'Updated' }, 'Second name', null)

    expect(second.id).toBe(first.id)
    const snapshot = await service.getSnapshot()
    expect(
      snapshot.items.filter(
        (item) => item.type === 'report' && item.reportId === report.reportId
      )
    ).toHaveLength(1)
    await expect(service.getReport(first.id)).resolves.toMatchObject({
      seasonLabel: 'Updated'
    })
  })

  it('moves items between folders and reorders them', async () => {
    const service = new LibraryService(await makeTempDir())
    const source = await service.createFolder('Source', null)
    const target = await service.createFolder('Target', null)
    const report = makeReport()
    const first = await service.saveReport(report, 'First', source.id)
    const second = await service.saveReport(
      { ...report, reportId: '00000000-0000-4000-8000-000000000002' },
      'Second',
      source.id
    )

    await service.moveItem(second.id, target.id, 0)
    await service.moveItem(first.id, target.id, 0)

    const snapshot = await service.getSnapshot()
    const targetItems = snapshot.items
      .filter((item) => item.folderId === target.id)
      .sort((a, b) => a.order - b.order)
      .map((item) => item.name)
    expect(targetItems).toEqual(['First', 'Second'])
  })

  it('deletes a report file with its item', async () => {
    const service = new LibraryService(await makeTempDir())
    const item = await service.saveReport(makeReport(), 'Report', null)

    await service.deleteItem(item.id)

    expect((await service.getSnapshot()).items).toEqual([])
    await expect(service.getReport(item.id)).rejects.toThrow('not found')
  })
})

describe('LibraryService rosters', () => {
  function makeDraft(overrides: Partial<RosterDraft> = {}): RosterDraft {
    const report = makeReport()
    return {
      name: 'August roster',
      folderId: null,
      sourceReportItemId: null,
      sourceReportName: 'August report',
      seasonLabel: report.seasonLabel,
      seasonKey: report.seasonKey,
      clans: [
        {
          tag: report.clans[0].tag,
          name: report.clans[0].name,
          league: report.clans[0].league
        }
      ],
      extraPlayers: [],
      players: report.players,
      ...overrides
    }
  }

  it('saves a roster snapshot that survives without the source report', async () => {
    const service = new LibraryService(await makeTempDir())
    const folder = await service.createFolder('Rosters', null)
    const reportItem = await service.saveReport(makeReport(), 'August report', folder.id)
    const draft = makeDraft({
      folderId: folder.id,
      sourceReportItemId: reportItem.id,
      players: makeReport().players.slice(0, 1)
    })

    const item = await service.saveRoster(draft)
    const roster = await service.getRoster(item.id)

    expect(item).toMatchObject({
      type: 'roster',
      folderId: folder.id,
      sourceReportItemId: reportItem.id,
      playerCount: 1
    })
    expect(roster.players).toEqual(draft.players)
    expect(roster.sourceReportName).toBe('August report')

    await service.deleteItem(reportItem.id)
    await expect(service.getRoster(item.id)).resolves.toMatchObject({
      players: draft.players
    })
  })

  it('updates an existing roster and keeps the name in sync', async () => {
    const service = new LibraryService(await makeTempDir())
    const draft = makeDraft()
    const item = await service.saveRoster(draft)

    await service.saveRoster({
      ...draft,
      id: item.id,
      name: 'Updated roster',
      players: draft.players.slice(0, 1)
    })

    const snapshot = await service.getSnapshot()
    expect(snapshot.items.filter((candidate) => candidate.type === 'roster')).toHaveLength(1)
    expect((await service.getRoster(item.id)).name).toBe('Updated roster')
    expect((await service.getRoster(item.id)).players).toHaveLength(1)

    await service.renameItem(item.id, 'Renamed from library')
    expect((await service.getRoster(item.id)).name).toBe('Renamed from library')
  })

  it('persists clan sections and extra players, and defaults legacy roster files', async () => {
    const dir = await makeTempDir()
    const service = new LibraryService(dir)
    const draft = makeDraft()
    const item = await service.saveRoster(draft)

    await expect(service.getRoster(item.id)).resolves.toMatchObject({
      seasonKey: '2026-08',
      clans: draft.clans,
      extraPlayers: []
    })

    const legacyPath = join(dir, 'rosters', `${item.id}.json`)
    await writeFile(
      legacyPath,
      JSON.stringify({
        version: 1,
        id: item.id,
        name: item.name,
        sourceReportItemId: item.sourceReportItemId,
        sourceReportName: item.sourceReportName,
        seasonLabel: item.seasonLabel,
        players: draft.players,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      }),
      'utf8'
    )

    const legacy = await service.getRoster(item.id)
    expect(legacy.seasonKey).toBeNull()
    expect(legacy.clans).toEqual([])
    expect(legacy.extraPlayers).toEqual([])
    expect(legacy.players).toEqual(draft.players)
  })
})

describe('LibraryService deletion and recovery', () => {
  it('deletes a folder tree and every item inside it', async () => {
    const service = new LibraryService(await makeTempDir())
    const parent = await service.createFolder('Parent', null)
    const child = await service.createFolder('Child', parent.id)
    const reportItem = await service.saveReport(makeReport(), 'Nested report', child.id)
    const rosterItem = await service.saveRoster({
      name: 'Nested roster',
      folderId: parent.id,
      sourceReportItemId: reportItem.id,
      sourceReportName: 'Nested report',
      seasonLabel: 'August 2026',
      players: makeReport().players
    })

    await service.deleteFolder(parent.id)

    const snapshot = await service.getSnapshot()
    expect(snapshot.folders).toEqual([])
    expect(snapshot.items).toEqual([])
    await expect(service.getReport(reportItem.id)).rejects.toThrow('not found')
    await expect(service.getRoster(rosterItem.id)).rejects.toThrow('not found')
  })

  it('falls back to an empty library when the index is corrupted', async () => {
    const dir = await makeTempDir()
    await writeFile(join(dir, 'library.json'), '{not json', 'utf8')

    await expect(new LibraryService(dir).getSnapshot()).resolves.toEqual({
      folders: [],
      items: []
    })
  })

  it('breaks parent cycles in a corrupted folder index', async () => {
    const dir = await makeTempDir()
    await writeFile(
      join(dir, 'library.json'),
      JSON.stringify({
        version: 1,
        folders: [
          { id: 'a', name: 'A', parentId: 'b', order: 0 },
          { id: 'b', name: 'B', parentId: 'a', order: 0 }
        ],
        items: []
      }),
      'utf8'
    )

    const snapshot = await new LibraryService(dir).getSnapshot()
    expect(snapshot.folders).toHaveLength(2)
    expect(snapshot.folders.some((folder) => folder.parentId === null)).toBe(true)
  })

  it('reports a missing snapshot file as invalid data', async () => {
    const dir = await makeTempDir()
    const service = new LibraryService(dir)
    const item = await service.saveReport(makeReport(), 'Report', null)

    await rm(join(dir, 'reports', `${item.id}.json`))

    await expect(service.getReport(item.id)).rejects.toThrow('missing or corrupted')
  })
})
