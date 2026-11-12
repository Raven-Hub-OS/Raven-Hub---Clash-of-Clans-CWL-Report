import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { ClashKingClient } from '../clashking/client'
import { writeWorkbookToFile } from '../export/xlsx'
import { generateReport } from './report'

/**
 * Manual live check against the real ClashKing API. Disabled by default.
 *
 *   LIVE_CLASHKING=1 LIVE_TAGS='#2YLCCLL0Y' npx vitest run src/main/domain/live.test.ts
 *
 * On PowerShell:
 *   $env:LIVE_CLASHKING='1'; $env:LIVE_TAGS='#2YLCCLL0Y'; npx vitest run src/main/domain/live.test.ts
 */
const live = process.env.LIVE_CLASHKING === '1'
const tags = (process.env.LIVE_TAGS ?? '#2YLCCLL0Y')
  .split(',')
  .map((tag) => tag.trim())
  .filter(Boolean)

const tempDirs: string[] = []

afterAll(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe.skipIf(!live)('live ClashKing report', () => {
  it('builds and exports a real report', async () => {
    const workDir = await mkdtemp(join(tmpdir(), 'raven-live-'))
    tempDirs.push(workDir)

    const client = new ClashKingClient({ cacheDir: join(workDir, 'cache') })
    const report = await generateReport({
      tags,
      client,
      signal: new AbortController().signal
    })

    console.log(
      JSON.stringify(
        {
          tags,
          season: report.season,
          clans: report.clans.map((clan) => ({
            tag: clan.tag,
            name: clan.name,
            league: clan.league,
            rank: clan.rank,
            rounds: clan.rounds,
            players: clan.players
          })),
          stats: report.stats,
          warnings: report.warnings
        },
        null,
        2
      )
    )

    expect(report.players.length).toBeGreaterThan(0)
    expect(report.season).toMatch(/^\d{4}-\d{2}/)

    for (const player of report.players) {
      expect(player.warsParticipated).toBeGreaterThan(0)
      expect(player.attacks).toBeLessThanOrEqual(player.warsParticipated)
      expect(player.missed).toBe(player.warsParticipated - player.attacks)
      expect(player.th).toBeGreaterThan(0)
    }

    expect(report.warnings.filter((warning) => warning.kind === 'sanity')).toEqual([])
    expect(report.warnings.filter((warning) => warning.kind === 'no-players')).toEqual([])

    const filePath = join(workDir, 'live-report.xlsx')
    await writeWorkbookToFile(report, filePath)
    expect((await stat(filePath)).size).toBeGreaterThan(1000)
  }, 180_000)
})
