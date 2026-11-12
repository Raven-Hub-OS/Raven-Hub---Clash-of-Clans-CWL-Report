import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { SettingsStore } from './settings'

const tempDirs: string[] = []

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'raven-settings-'))
  tempDirs.push(dir)
  return dir
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('SettingsStore', () => {
  it('returns safe defaults when the file does not exist', async () => {
    const store = new SettingsStore(join(await makeTempDir(), 'settings.json'))

    await expect(store.get()).resolves.toEqual({
      version: 1,
      lastTags: [],
      lastReportFolderId: null,
      lastRosterFolderId: null
    })
  })

  it('persists tags and folder choices across instances', async () => {
    const filePath = join(await makeTempDir(), 'settings.json')
    const store = new SettingsStore(filePath)

    await store.update({ lastTags: ['#2AAAAAAA', '#2BBBBBBB'] })
    await store.update({ lastReportFolderId: 'folder-report' })
    const result = await store.update({ lastRosterFolderId: 'folder-roster' })

    expect(result).toEqual({
      version: 1,
      lastTags: ['#2AAAAAAA', '#2BBBBBBB'],
      lastReportFolderId: 'folder-report',
      lastRosterFolderId: 'folder-roster'
    })

    const reloaded = new SettingsStore(filePath)
    await expect(reloaded.get()).resolves.toEqual(result)
  })

  it('recovers from corrupted JSON with defaults', async () => {
    const dir = await makeTempDir()
    const filePath = join(dir, 'settings.json')
    await writeFile(filePath, '{not json', 'utf8')

    await expect(new SettingsStore(filePath).get()).resolves.toMatchObject({
      lastTags: [],
      lastReportFolderId: null
    })

    await new SettingsStore(filePath).update({ lastTags: ['#2AAAAAAA'] })
    const raw = JSON.parse(await readFile(filePath, 'utf8')) as { lastTags: string[] }
    expect(raw.lastTags).toEqual(['#2AAAAAAA'])
  })

  it('sanitizes invalid stored values', async () => {
    const dir = await makeTempDir()
    const filePath = join(dir, 'settings.json')
    await writeFile(
      filePath,
      JSON.stringify({
        version: 99,
        lastTags: ['#2AAAAAAA', 42, null, '#2BBBBBBB'],
        lastReportFolderId: 7,
        lastRosterFolderId: ''
      }),
      'utf8'
    )

    await expect(new SettingsStore(filePath).get()).resolves.toEqual({
      version: 1,
      lastTags: ['#2AAAAAAA', '#2BBBBBBB'],
      lastReportFolderId: null,
      lastRosterFolderId: null
    })
  })
})
