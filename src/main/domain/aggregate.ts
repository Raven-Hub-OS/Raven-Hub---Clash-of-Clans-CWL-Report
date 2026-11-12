import type {
  PlayerRow,
  ReportClan,
  ReportStats,
  ReportWarning,
  WarningKind
} from '@shared/types'
import { normalizeTag } from '@shared/tags'
import type { CwlGroup, CwlWar, SeasonInfo, WarMember } from '../clashking/types'
import { isCwlWar, memberTownHall } from '../clashking/types'

export interface ClanAggregationInput {
  clanTag: string
  season: SeasonInfo
  group: CwlGroup
}

export interface ClanAggregationResult {
  clan: ReportClan
  players: PlayerRow[]
  warnings: ReportWarning[]
}

interface PlayerAccumulator {
  tag: string
  name: string
  th: number
  lastWarTime: string
  warsParticipated: number
  attacks: number
  attackStars: number
  destruction: number
  defenses: number
  defenseStars: number
  reaches: number
  dips: number
}

interface DefenseTotals {
  count: number
  stars: number
}

export function aggregateClan(input: ClanAggregationInput): ClanAggregationResult {
  const { clanTag, season, group } = input
  const warnings: ReportWarning[] = []
  const groupClan = group.clans?.find((clan) => normalizeTag(clan.tag) === clanTag)
  const clanName = groupClan?.name ?? clanTag

  if (group.state !== 'ended') {
    warnings.push(
      makeWarning(
        'partial-war',
        'ClashKing reports this season as still in progress. Only completed wars were included.',
        clanTag,
        clanName,
        `Group state: ${group.state}`
      )
    )
  }

  const players = new Map<string, PlayerAccumulator>()
  const seenWars = new Set<string>()
  let skippedWars = 0
  let unmatchedDefenders = 0
  let warOrder = 0

  for (const round of group.rounds ?? []) {
    for (const rawWar of round.warTags ?? []) {
      if (!isCwlWar(rawWar)) {
        skippedWars += 1
        continue
      }

      const war = rawWar
      const warKey =
        war.tag ??
        `${war.clan.tag}-${war.opponent.tag}-${war.startTime ?? war.endTime ?? warOrder}`
      if (seenWars.has(warKey)) continue
      seenWars.add(warKey)
      warOrder += 1

      if (war.state !== 'warEnded') {
        skippedWars += 1
        continue
      }

      const sides = resolveSides(war, clanTag)
      if (!sides) continue

      const { side, opponent } = sides
      const defenseTotals = collectDefenseTotals(opponent.members)
      const attackTotalBefore = sumPlayerAttacks(players)
      const starTotalBefore = sumPlayerAttackStars(players)
      let usableMembers = 0

      for (const member of side.members) {
        if (!isUsableMember(member)) continue

        const tag = normalizeTag(member.tag)
        if (!tag) continue

        usableMembers += 1
        const attackerTh = memberTownHall(member)
        const accumulator = getAccumulator(players, tag, member, war)
        accumulator.warsParticipated += 1

        for (const attack of member.attacks ?? []) {
          accumulator.attacks += 1
          accumulator.attackStars += finiteNumber(attack.stars)
          accumulator.destruction += finiteNumber(attack.destructionPercentage)

          const defender = opponent.members.find(
            (candidate) => normalizeTag(candidate.tag) === normalizeTag(attack.defenderTag)
          )
          if (!defender) {
            unmatchedDefenders += 1
            continue
          }

          const defenderTh = memberTownHall(defender)
          if (attackerTh < defenderTh) accumulator.reaches += 1
          if (attackerTh > defenderTh) accumulator.dips += 1
        }

        const defense = defenseTotals.get(tag)
        if (defense) {
          accumulator.defenses += defense.count
          accumulator.defenseStars += defense.stars
        }
      }

      if (usableMembers === 0) skippedWars += 1

      maybeSanityWarning(
        warnings,
        clanTag,
        clanName,
        war,
        side,
        sumPlayerAttacks(players) - attackTotalBefore,
        sumPlayerAttackStars(players) - starTotalBefore
      )
    }
  }

  if (skippedWars > 0) {
    warnings.push(
      makeWarning(
        'partial-war',
        'Some CWL wars could not be included because they were incomplete or malformed.',
        clanTag,
        clanName,
        `${skippedWars} war${skippedWars === 1 ? '' : 's'} skipped`
      )
    )
  }

  if (unmatchedDefenders > 0) {
    warnings.push(
      makeWarning(
        'incomplete-data',
        'Some attacks could not be matched to the defender. Reaches and dips may be slightly off.',
        clanTag,
        clanName,
        `${unmatchedDefenders} attack${unmatchedDefenders === 1 ? '' : 's'} unmatched`
      )
    )
  }

  const rows = [...players.values()].map((player) => toPlayerRow(player, clanTag, clanName))
  rows.sort((a, b) => a.name.localeCompare(b.name, 'en') || b.attackStars - a.attackStars)

  if (rows.length === 0) {
    warnings.push(
      makeWarning(
        'no-players',
        'ClashKing has no player data for this clan in the selected season.',
        clanTag,
        clanName
      )
    )
  }

  return {
    clan: {
      tag: clanTag,
      name: clanName,
      season: season.season,
      league: season.warLeague?.name ?? group.warLeague?.name ?? null,
      rank: numberOrNull(season.rank),
      stars: numberOrNull(season.stars),
      destruction: numberOrNull(season.destruction),
      rounds: season.rounds ?? null,
      players: rows.length
    },
    players: rows,
    warnings
  }
}

export function buildReportStats(players: PlayerRow[], clanCount: number): ReportStats {
  const attacks = sum(players.map((player) => player.attacks))
  const attackStars = sum(players.map((player) => player.attackStars))
  const defenses = sum(players.map((player) => player.defenses))
  const defenseStars = sum(players.map((player) => player.defenseStars))

  return {
    clans: clanCount,
    players: players.length,
    attacks,
    missed: sum(players.map((player) => player.missed)),
    attackStars,
    defenses,
    avgStars: attacks > 0 ? roundTo(attackStars / attacks, 3) : 0,
    avgDefense: defenses > 0 ? roundTo(defenseStars / defenses, 3) : 0
  }
}

function resolveSides(
  war: CwlWar,
  clanTag: string
): { side: CwlWar['clan']; opponent: CwlWar['opponent'] } | null {
  if (normalizeTag(war.clan.tag) === clanTag) {
    return { side: war.clan, opponent: war.opponent }
  }
  if (normalizeTag(war.opponent.tag) === clanTag) {
    return { side: war.opponent, opponent: war.clan }
  }
  return null
}

function isUsableMember(member: WarMember): boolean {
  return typeof member.tag === 'string' && typeof member.name === 'string'
}

function getAccumulator(
  players: Map<string, PlayerAccumulator>,
  tag: string,
  member: WarMember,
  war: CwlWar
): PlayerAccumulator {
  const warTime = war.endTime ?? war.startTime ?? ''
  let accumulator = players.get(tag)

  if (!accumulator) {
    accumulator = {
      tag,
      name: member.name,
      th: memberTownHall(member),
      lastWarTime: warTime,
      warsParticipated: 0,
      attacks: 0,
      attackStars: 0,
      destruction: 0,
      defenses: 0,
      defenseStars: 0,
      reaches: 0,
      dips: 0
    }
    players.set(tag, accumulator)
    return accumulator
  }

  if (warTime >= accumulator.lastWarTime) {
    accumulator.name = member.name
    accumulator.th = memberTownHall(member)
    accumulator.lastWarTime = warTime
  }

  return accumulator
}

function collectDefenseTotals(members: WarMember[]): Map<string, DefenseTotals> {
  const totals = new Map<string, DefenseTotals>()

  for (const member of members) {
    for (const attack of member.attacks ?? []) {
      const defenderTag = normalizeTag(attack.defenderTag)
      if (!defenderTag) continue

      const current = totals.get(defenderTag) ?? { count: 0, stars: 0 }
      current.count += 1
      current.stars += finiteNumber(attack.stars)
      totals.set(defenderTag, current)
    }
  }

  return totals
}

function sumPlayerAttacks(players: Map<string, PlayerAccumulator>): number {
  let total = 0
  for (const player of players.values()) total += player.attacks
  return total
}

function sumPlayerAttackStars(players: Map<string, PlayerAccumulator>): number {
  let total = 0
  for (const player of players.values()) total += player.attackStars
  return total
}

function maybeSanityWarning(
  warnings: ReportWarning[],
  clanTag: string,
  clanName: string,
  war: CwlWar,
  side: CwlWar['clan'],
  warAttacks: number,
  warStars: number
): void {
  const details: string[] = []

  if (typeof side.attacks === 'number' && side.attacks !== warAttacks) {
    details.push(`attacks expected ${side.attacks}, found ${warAttacks}`)
  }
  if (typeof side.stars === 'number' && side.stars !== warStars) {
    details.push(`stars expected ${side.stars}, found ${warStars}`)
  }
  if (details.length === 0) return

  warnings.push(
    makeWarning(
      'sanity',
      'A war total does not match the ClashKing summary. The data may be incomplete.',
      clanTag,
      clanName,
      `${war.tag ?? `${war.clan.name} vs ${war.opponent.name}`}: ${details.join('; ')}`
    )
  )
}

function toPlayerRow(
  player: PlayerAccumulator,
  clanTag: string,
  clanName: string
): PlayerRow {
  return {
    clanTag,
    clan: clanName,
    name: player.name,
    tag: player.tag,
    th: player.th,
    warsParticipated: player.warsParticipated,
    attacks: player.attacks,
    missed: Math.max(0, player.warsParticipated - player.attacks),
    attackStars: player.attackStars,
    avgStars: player.attacks > 0 ? roundTo(player.attackStars / player.attacks, 3) : 0,
    destruction: roundTo(player.destruction, 2),
    defenses: player.defenses,
    defenseStars: player.defenseStars,
    avgDefense: player.defenses > 0 ? roundTo(player.defenseStars / player.defenses, 3) : 0,
    reaches: player.reaches,
    dips: player.dips
  }
}

function makeWarning(
  kind: WarningKind,
  message: string,
  clanTag?: string,
  clanName?: string,
  detail?: string
): ReportWarning {
  return { kind, message, clanTag, clanName, detail }
}

function finiteNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits
  return Math.round((value + Number.EPSILON) * factor) / factor
}
