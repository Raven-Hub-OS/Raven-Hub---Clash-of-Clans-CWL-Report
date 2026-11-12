import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import ExcelJS from 'exceljs'
import { afterEach, describe, expect, it } from 'vitest'
import { APP_NAME } from '@shared/app'
import {
  buildFileName,
  buildWorkbook,
  PLAYER_COLUMNS,
  writeWorkbookToFile
} from './xlsx'
import { makeReport } from '../domain/testFixtures'

const tempDirs: string[] = []

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'raven-xlsx-'))
  tempDirs.push(dir)
  return dir
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('buildWorkbook', () => {
  it('creates a single Players sheet with the expected headers', () => {
    const workbook = buildWorkbook(makeReport())

    expect(workbook.worksheets).toHaveLength(1)
    const sheet = workbook.getWorksheet('Players')
    expect(sheet).toBeDefined()

    const headers = PLAYER_COLUMNS.map((column) => sheet?.getRow(1).getCell(
      PLAYER_COLUMNS.indexOf(column) + 1
    ).value)
    expect(headers).toEqual(PLAYER_COLUMNS.map((column) => column.header))
  })

  it('writes one row per player with numeric values', () => {
    const workbook = buildWorkbook(makeReport())
    const sheet = workbook.getWorksheet('Players')!

    expect(sheet.rowCount).toBe(3)

    expect(sheet.getRow(2).getCell(1).value).toBe('Raven Clan')
    expect(sheet.getRow(2).getCell(2).value).toBe('Alpha')
    expect(sheet.getRow(2).getCell(3).value).toBe('#2CCCCCCC')
    expect(sheet.getRow(2).getCell(4).value).toBe(15)
    expect(sheet.getRow(2).getCell(5).value).toBe(2)
    expect(sheet.getRow(2).getCell(6).value).toBe(2)
    expect(sheet.getRow(2).getCell(7).value).toBe(0)
    expect(sheet.getRow(2).getCell(8).value).toBe(4)
    expect(sheet.getRow(2).getCell(9).value).toBe(2)
    expect(sheet.getRow(3).getCell(2).value).toBe('Bravo')
  })

  it('stores the full player tag in the # column', () => {
    const sheet = buildWorkbook(makeReport()).getWorksheet('Players')!
    const tags = [sheet.getRow(2).getCell(3).value, sheet.getRow(3).getCell(3).value]

    expect(tags).toEqual(['#2CCCCCCC', '#2DDDDDDD'])
  })

  it('adds styling, autofilter, freeze pane and conditional formatting', () => {
    const workbook = buildWorkbook(makeReport())
    const sheet = workbook.getWorksheet('Players')!

    expect(sheet.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 })
    expect(sheet.autoFilter).toBe('A1:O3')

    // ExcelJS exposes this at runtime but does not declare it on the worksheet type.
    const conditionalFormattings = (
      sheet as unknown as { conditionalFormattings: unknown[] }
    ).conditionalFormattings
    expect(conditionalFormattings.length).toBeGreaterThan(0)
    expect(sheet.getRow(1).getCell(1).font?.bold).toBe(true)
    expect(sheet.getRow(1).getCell(1).fill).toMatchObject({ fgColor: { argb: 'FF1E2230' } })
    expect(sheet.pageSetup.orientation).toBe('landscape')
  })

  it('records the data source and legal notice in workbook metadata', () => {
    const workbook = buildWorkbook(makeReport())

    expect(workbook.title).toContain('2026-08')
    expect(workbook.description).toContain('ClashKing')
    expect(workbook.description).toContain('Supercell')
    expect(workbook.creator).toBe(APP_NAME)
  })

  it('works with an empty player list', () => {
    const report = makeReport({ players: [], stats: {
      clans: 1,
      players: 0,
      attacks: 0,
      missed: 0,
      attackStars: 0,
      defenses: 0,
      avgStars: 0,
      avgDefense: 0
    } })
    const sheet = buildWorkbook(report).getWorksheet('Players')!

    expect(sheet.rowCount).toBe(1)
    expect(sheet.autoFilter).toBe('A1:O1')
  })
})

describe('writeWorkbookToFile', () => {
  it('writes an xlsx file that ExcelJS can read back', async () => {
    const dir = await makeTempDir()
    const filePath = join(dir, 'report.xlsx')

    await writeWorkbookToFile(makeReport(), filePath)

    const bytes = await readFile(filePath)
    expect(bytes.byteLength).toBeGreaterThan(0)
    expect(bytes.subarray(0, 2).toString()).toBe('PK')

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.readFile(filePath)
    const sheet = workbook.getWorksheet('Players')

    expect(sheet?.rowCount).toBe(3)
    expect(sheet?.getRow(2).getCell(2).value).toBe('Alpha')
    expect(sheet?.getRow(2).getCell(3).value).toBe('#2CCCCCCC')
  })
})

describe('buildFileName', () => {
  it('includes the season and clan count', () => {
    expect(buildFileName(makeReport())).toBe('RavenHub_CWL_2026-08_1clan.xlsx')
  })

  it('uses a plural label for multiple clans', () => {
    const report = makeReport()
    report.clans = [report.clans[0], { ...report.clans[0], tag: '#2BBBBBBB' }]

    expect(buildFileName(report)).toBe('RavenHub_CWL_2026-08_2clans.xlsx')
  })

  it('sanitizes unusual season strings', () => {
    const report = makeReport({ season: '2026/08 extra' })

    expect(buildFileName(report)).toBe('RavenHub_CWL_2026-08-extra_1clan.xlsx')
  })
})
