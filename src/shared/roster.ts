import type { PlayerRow, RosterClan } from './types'

export function rosterPlayerKey(player: Pick<PlayerRow, 'clanTag' | 'tag'>): string {
  return `${player.clanTag}:${player.tag}`
}

/**
 * Places a player in a roster section without changing their report stats.
 * The target clan owns the row from then on, even when the player originally
 * played for a different clan in the source report.
 */
export function assignPlayerToClan(
  player: PlayerRow,
  clan: Pick<RosterClan, 'tag' | 'name'>
): PlayerRow {
  if (player.clanTag === clan.tag && player.clan === clan.name) return player
  return { ...player, clanTag: clan.tag, clan: clan.name }
}

export function moveRosterRow<T>(rows: T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex === toIndex) return rows
  if (fromIndex < 0 || fromIndex >= rows.length) return rows

  const next = [...rows]
  const [row] = next.splice(fromIndex, 1)
  const target = Math.max(0, Math.min(toIndex, next.length))
  next.splice(target, 0, row)
  return next
}

export function moveRosterRowBy<T>(rows: T[], index: number, delta: number): T[] {
  return moveRosterRow(rows, index, index + delta)
}

export function removeRosterRow<T>(rows: T[], index: number): T[] {
  if (index < 0 || index >= rows.length) return rows
  return rows.filter((_row, position) => position !== index)
}
