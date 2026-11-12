#!/usr/bin/env node
/**
 * Live ClashKing coverage check.
 *
 * Usage:
 *   node scripts/check-clashking.mjs '#2YLCCLL0Y' '#GCQL0029'
 *   node scripts/check-clashking.mjs --season=2026-08 '#2YLCCLL0Y'
 *
 * This is a diagnostic helper, not part of the app. It uses the same public
 * endpoints and makes no changes to anything.
 */

const BASE_URL = 'https://api.clashk.ing'
const USER_AGENT = 'RavenHubCWLReport/0.1.0 (coverage check)'

const args = process.argv.slice(2)
const seasonArg = args.find((arg) => arg.startsWith('--season='))?.slice('--season='.length)
const rawTags = args.filter((arg) => !arg.startsWith('--'))

if (rawTags.length === 0) {
  console.error("Usage: node scripts/check-clashking.mjs '#CLANTAG' ['#CLANTAG' ...] [--season=YYYY-MM]")
  process.exit(1)
}

for (const rawTag of rawTags) {
  const tag = normalizeTag(rawTag)
  if (!tag) {
    console.log(`\n${rawTag}: invalid tag, skipped`)
    continue
  }

  try {
    const seasons = await getJson(`/v2/cwl/${encodeURIComponent(tag)}/seasons?limit=24`)
    const items = Array.isArray(seasons.items) ? seasons.items : []
    const ended = items
      .filter((item) => item.state === 'ended')
      .sort((a, b) => sortValue(b.season) - sortValue(a.season))

    console.log(`\n${tag}`)
    console.log(`  seasons returned: ${items.length}`)
    console.log(
      `  ended seasons: ${
        ended.length > 0
          ? ended.slice(0, 5).map((item) => `${item.season} (${item.state})`).join(', ')
          : 'none'
      }`
    )

    const requested = seasonArg ? ended.find((item) => seasonKey(item.season) === seasonArg) : ended[0]
    if (!requested) {
      console.log(`  no ended season available${seasonArg ? ` for ${seasonArg}` : ''}`)
      continue
    }

    const group = await getJson(
      `/v2/cwl/${encodeURIComponent(tag)}/group?season=${encodeURIComponent(requested.season)}`
    )
    const rounds = Array.isArray(group.rounds) ? group.rounds : []
    const wars = rounds.flatMap((round) => (Array.isArray(round.warTags) ? round.warTags : []))
    const embedded = wars.filter((war) => war && typeof war === 'object')
    const endedWars = embedded.filter((war) => war.state === 'warEnded')
    const clan = Array.isArray(group.clans)
      ? group.clans.find((entry) => normalizeTag(entry.tag) === tag)
      : undefined
    const playerRows = endedWars.reduce((total, war) => {
      const side = normalizeTag(war.clan?.tag) === tag ? war.clan : war.opponent
      return total + (Array.isArray(side?.members) ? side.members.length : 0)
    }, 0)

    console.log(`  checked season: ${requested.season} (group state: ${group.state})`)
    console.log(`  clan: ${clan?.name ?? 'not listed in group.clans'}`)
    console.log(
      `  rounds: ${rounds.length}, embedded wars: ${embedded.length}, ended wars: ${endedWars.length}`
    )
    console.log(`  player appearances across ended wars: ${playerRows}`)
  } catch (error) {
    console.log(`\n${tag}`)
    console.log(`  ERROR: ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function getJson(path) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(45_000)
  })
  const text = await response.text()
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`)
  }
  try {
    return JSON.parse(text)
  } catch {
    throw new Error('ClashKing returned invalid JSON')
  }
}

function normalizeTag(value) {
  const cleaned = String(value).trim().replace(/^#+/, '').toUpperCase()
  return /^[0-9A-Z]{3,12}$/.test(cleaned) ? `#${cleaned}` : null
}

function seasonKey(value) {
  const match = /^(\d{4})-(\d{2})/.exec(String(value).trim())
  return match ? `${match[1]}-${match[2]}` : String(value).trim()
}

function sortValue(value) {
  const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(String(value).trim())
  if (!match) return 0
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3] ?? 1))
}
