export interface WarLeague {
  id: number
  name: string
}

export interface SeasonRounds {
  won: number
  tied: number
  lost: number
}

export interface SeasonInfo {
  season: string
  state: string
  warSize?: number | null
  warLeague?: WarLeague | null
  rank?: number | null
  stars?: number | null
  destruction?: number | null
  rounds?: SeasonRounds | null
}

export interface WarAttack {
  attackerTag: string
  defenderTag: string
  stars: number
  destructionPercentage: number
  order?: number
  duration?: number
}

export interface WarMember {
  tag: string
  name: string
  /**
   * ClashKing has used both spellings over time. `townhallLevel` is what the
   * current v2 API returns; `townHallLevel` is kept for cached payloads and
   * older responses.
   */
  townHallLevel?: number
  townhallLevel?: number
  mapPosition?: number
  attacks?: WarAttack[]
  opponentAttacks?: number
  bestOpponentAttack?: WarAttack | null
}

export interface WarSide {
  tag: string
  name: string
  clanLevel?: number
  badgeUrls?: { small?: string; medium?: string; large?: string }
  attacks?: number
  stars?: number
  destructionPercentage?: number
  members: WarMember[]
}

export interface CwlWar {
  tag?: string
  state: string
  teamSize?: number
  startTime?: string
  endTime?: string
  clan: WarSide
  opponent: WarSide
}

export interface CwlGroupClan {
  tag: string
  name: string
  clanLevel?: number
  badgeUrls?: { small?: string; medium?: string; large?: string }
  members?: Array<{
    tag: string
    name: string
    townHallLevel?: number
    townhallLevel?: number
  }>
}

export interface CwlGroup {
  state: string
  season: string
  warLeague?: WarLeague | null
  clans?: CwlGroupClan[]
  rounds: Array<{ warTags: unknown[] }>
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isWarAttack(value: unknown): value is WarAttack {
  return (
    isRecord(value) &&
    typeof value.attackerTag === 'string' &&
    typeof value.defenderTag === 'string' &&
    typeof value.stars === 'number' &&
    typeof value.destructionPercentage === 'number'
  )
}

export function isWarMember(value: unknown): value is WarMember {
  if (!isRecord(value)) return false
  if (typeof value.tag !== 'string' || typeof value.name !== 'string') return false
  if (!Number.isFinite(memberTownHall(value))) return false
  if (value.attacks !== undefined) {
    if (!Array.isArray(value.attacks) || !value.attacks.every(isWarAttack)) return false
  }
  return true
}

/**
 * Reads the Town Hall level from either API spelling. Returns NaN when the
 * payload has no usable value so callers can distinguish "unknown" from TH 0.
 */
export function memberTownHall(member: {
  townHallLevel?: unknown
  townhallLevel?: unknown
}): number {
  const value = member.townHallLevel ?? member.townhallLevel
  return typeof value === 'number' && Number.isFinite(value) ? value : Number.NaN
}

export function isWarSide(value: unknown): value is WarSide {
  return (
    isRecord(value) &&
    typeof value.tag === 'string' &&
    typeof value.name === 'string' &&
    Array.isArray(value.members) &&
    value.members.every(isWarMember)
  )
}

export function isCwlWar(value: unknown): value is CwlWar {
  return (
    isRecord(value) &&
    typeof value.state === 'string' &&
    isWarSide(value.clan) &&
    isWarSide(value.opponent)
  )
}
