import { describe, expect, it } from 'vitest'
import {
  assignPlayerToClan,
  moveRosterRow,
  moveRosterRowBy,
  removeRosterRow,
  rosterPlayerKey
} from './roster'
import { makePlayer } from '../main/domain/testFixtures'

describe('rosterPlayerKey', () => {
  it('combines the clan and player tags', () => {
    expect(rosterPlayerKey(makePlayer())).toBe('#2AAAAAAA:#2CCCCCCC')
  })
})

describe('assignPlayerToClan', () => {
  it('moves a player to the target clan without changing their stats', () => {
    const player = makePlayer()
    const assigned = assignPlayerToClan(player, {
      tag: '#2BBBBBBB',
      name: 'Beta'
    })

    expect(assigned).toEqual({ ...player, clanTag: '#2BBBBBBB', clan: 'Beta' })
    expect(player.clanTag).toBe('#2AAAAAAA')
  })

  it('returns the same player when the clan is unchanged', () => {
    const player = makePlayer()

    expect(
      assignPlayerToClan(player, { tag: player.clanTag, name: player.clan })
    ).toBe(player)
  })
})

describe('moveRosterRow', () => {
  const rows = ['a', 'b', 'c', 'd']

  it('moves a row down to the requested position', () => {
    expect(moveRosterRow(rows, 0, 2)).toEqual(['b', 'c', 'a', 'd'])
  })

  it('moves a row up to the requested position', () => {
    expect(moveRosterRow(rows, 3, 1)).toEqual(['a', 'd', 'b', 'c'])
  })

  it('moves a row to the end when the target is larger', () => {
    expect(moveRosterRow(rows, 1, 99)).toEqual(['a', 'c', 'd', 'b'])
  })

  it('does not mutate the original rows', () => {
    const result = moveRosterRow(rows, 0, 2)

    expect(rows).toEqual(['a', 'b', 'c', 'd'])
    expect(result).not.toBe(rows)
  })

  it('returns the original array for a no-op or invalid index', () => {
    expect(moveRosterRow(rows, 1, 1)).toBe(rows)
    expect(moveRosterRow(rows, -1, 2)).toBe(rows)
    expect(moveRosterRow(rows, 4, 2)).toBe(rows)
  })
})

describe('moveRosterRowBy', () => {
  it('moves a row relative to its current position', () => {
    expect(moveRosterRowBy(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'c', 'b'])
    expect(moveRosterRowBy(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c'])
  })
})

describe('removeRosterRow', () => {
  it('removes the row at the index', () => {
    expect(removeRosterRow(['a', 'b', 'c'], 1)).toEqual(['a', 'c'])
  })

  it('returns the original array for an invalid index', () => {
    const rows = ['a', 'b']
    expect(removeRosterRow(rows, -1)).toBe(rows)
    expect(removeRosterRow(rows, 2)).toBe(rows)
  })
})
