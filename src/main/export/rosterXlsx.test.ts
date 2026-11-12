import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import ExcelJS from 'exceljs'
import { afterEach, describe, expect, it } from 'vitest'
import { APP_NAME } from '@shared/app'
import { CLAN_TAG, makePlayer, makeReport } from '../domain/testFixtures'
import {
  buildRosterFileName,
  buildRosterWorkbook,
  ROSTER_COLUMNS,
  writeRosterToFile,
  type RosterExportData
} from './rosterXlsx'

const tempDirs: string[] = []

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'raven-roster-xlsx-'))
  tempDirs.push(dir)
  return dir
}

function makeRoster(): RosterExportData {
  return {
    name: 'August roster',
    seasonLabel: 'August 2026',
    sourceReportName: 'August report',
    clans: [{ tag: CLAN_TAG, name: 'Raven Clan', league: 'Legend League' }],
    players: makeReport().players
  }
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('buildRosterWorkbook', () => {
  it('creates a Roster sheet with the expected headers', () => {
    const workbook = buildRosterWorkbook(makeRoster())
    const sheet = workbook.getWorksheet('Roster')

    expect(workbook.worksheets).toHaveLength(1)
    expect(sheet).toBeDefined()
    expect(
      ROSTER_COLUMNS.map((column, index) => sheet?.getRow(1).getCell(index + 1).value)
    ).toEqual(ROSTER_COLUMNS.map((column) => column.header))
  })

  it('writes the roster order and player values', () => {
    const sheet = buildRosterWorkbook(makeRoster()).getWorksheet('Roster')!

    expect(sheet.rowCount).toBe(3)
    expect(sheet.getRow(2).getCell(1).value).toBe(1)
    expect(sheet.getRow(2).getCell(2).value).toBe('Raven Clan')
    expect(sheet.getRow(2).getCell(3).value).toBe('Alpha')
    expect(sheet.getRow(2).getCell(4).value).toBe('#2CCCCCCC')
    expect(sheet.getRow(2).getCell(5).value).toBe(15)
    expect(sheet.getRow(2).getCell(16).value).toBe(1)
    expect(sheet.getRow(3).getCell(1).value).toBe(2)
    expect(sheet.getRow(3).getCell(3).value).toBe('Bravo')
  })

  it('adds styling, autofilter, freeze pane and sheet metadata', () => {
    const workbook = buildRosterWorkbook(makeRoster())
    const sheet = workbook.getWorksheet('Roster')!

    expect(sheet.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 })
    expect(sheet.autoFilter).toBe('A1:P3')
    expect(sheet.getRow(1).getCell(1).font?.bold).toBe(true)
    expect(sheet.getRow(1).getCell(1).fill).toMatchObject({ fgColor: { argb: 'FF1E2230' } })
    expect(sheet.pageSetup.orientation).toBe('landscape')
    expect(workbook.creator).toBe(APP_NAME)
    expect(workbook.description).toContain('August report')
    expect(workbook.description).toContain('ClashKing')
    expect(workbook.description).toContain('Supercell')
  })

  it('orders a single table by clan league, strongest first', () => {
    const roster: RosterExportData = {
      ...makeRoster(),
      clans: [
        { tag: '#BRONZE', name: 'Bronze Clan', league: 'Bronze League I' },
        { tag: '#LEGEND', name: 'Legend Clan', league: 'Legend League' }
      ],
      players: [
        makePlayer({
          name: 'Bronze Player',
          tag: '#BRONZE1',
          clanTag: '#BRONZE',
          clan: 'Bronze Clan'
        }),
        makePlayer({
          name: 'Legend Player',
          tag: '#LEGEND1',
          clanTag: '#LEGEND',
          clan: 'Legend Clan'
        })
      ]
    }

    const workbook = buildRosterWorkbook(roster)
    const sheet = workbook.getWorksheet('Roster')!

    expect(workbook.worksheets).toHaveLength(1)
    expect(sheet.getRow(2).getCell(3).value).toBe('Legend Player')
    expect(sheet.getRow(3).getCell(3).value).toBe('Bronze Player')
  })

  it('works with an empty roster', () => {
    const workbook = buildRosterWorkbook({ ...makeRoster(), players: [] })
    const sheet = workbook.getWorksheet('Roster')!

    expect(sheet.rowCount).toBe(1)
    expect(sheet.autoFilter).toBe('A1:P1')
  })
})

describe('writeRosterToFile', () => {
  it('writes an xlsx file that ExcelJS can read back', async () => {
    const filePath = join(await makeTempDir(), 'roster.xlsx')

    await writeRosterToFile(makeRoster(), filePath)

    const bytes = await readFile(filePath)
    expect(bytes.byteLength).toBeGreaterThan(0)
    expect(bytes.subarray(0, 2).toString()).toBe('PK')

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.readFile(filePath)
    const sheet = workbook.getWorksheet('Roster')

    expect(sheet?.rowCount).toBe(3)
    expect(sheet?.getRow(2).getCell(3).value).toBe('Alpha')
  })
})

describe('buildRosterFileName', () => {
  it('includes the season and player count', () => {
    expect(buildRosterFileName(makeRoster())).toBe('RavenHub_Roster_August-2026_2players.xlsx')
  })

  it('uses a singular label for one player', () => {
    const roster = makeRoster()
    roster.players = roster.players.slice(0, 1)

    expect(buildRosterFileName(roster)).toBe('RavenHub_Roster_August-2026_1player.xlsx')
  })

  it('sanitizes unusual season strings', () => {
    expect(buildRosterFileName({ ...makeRoster(), seasonLabel: '2026/08 extra' })).toBe(
      'RavenHub_Roster_2026-08-extra_2players.xlsx'
    )
  })
})
