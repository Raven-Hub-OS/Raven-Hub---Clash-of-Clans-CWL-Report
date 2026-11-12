import { describe, expect, it } from 'vitest'
import type { SeasonInfo } from '../clashking/types'
import { selectLatestEndedSeason } from './seasons'

function season(name: string, state = 'ended'): SeasonInfo {
  return { season: name, state }
}

describe('selectLatestEndedSeason', () => {
  it('returns null when there is no clan data', () => {
    expect(selectLatestEndedSeason([])).toBeNull()
  })

  it('ignores seasons that are still in progress', () => {
    const selection = selectLatestEndedSeason([
      { clanTag: '#AAA', seasons: [season('2026-09', 'preparation'), season('2026-08')] },
      { clanTag: '#BBB', seasons: [season('2026-08')] }
    ])

    expect(selection?.season).toBe('2026-08')
    expect(selection?.key).toBe('2026-08')
    expect(selection?.label).toBe('August 2026')
    expect(selection?.coveredCount).toBe(2)
    expect(selection?.missing).toEqual([])
  })

  it('returns null when every season is ongoing', () => {
    const selection = selectLatestEndedSeason([
      { clanTag: '#AAA', seasons: [season('2026-09', 'warEnded')] }
    ])

    expect(selection).toBeNull()
  })

  it('picks the newest ended season across clans and flags missing clans', () => {
    const selection = selectLatestEndedSeason([
      {
        clanTag: '#AAA',
        seasons: [season('2026-09'), season('2026-08'), season('2026-07')]
      },
      { clanTag: '#BBB', seasons: [season('2026-07')] },
      { clanTag: '#CCC', seasons: [season('2026-08')] }
    ])

    expect(selection?.season).toBe('2026-09')
    expect(selection?.matches.map((match) => match.clanTag)).toEqual(['#AAA'])
    expect(selection?.missing).toEqual([
      { clanTag: '#BBB', latestAvailable: '2026-07' },
      { clanTag: '#CCC', latestAvailable: '2026-08' }
    ])
  })

  it('compares mixed ClashKing formats by month', () => {
    const selection = selectLatestEndedSeason([
      { clanTag: '#AAA', seasons: [season('2026-08-03')] },
      { clanTag: '#BBB', seasons: [season('2026-08')] }
    ])

    expect(selection?.key).toBe('2026-08')
    expect(selection?.coveredCount).toBe(2)
    expect(selection?.matches).toHaveLength(2)
    expect(selection?.missing).toEqual([])
  })

  it('prefers the newest raw season string when months are equal', () => {
    const selection = selectLatestEndedSeason([
      { clanTag: '#AAA', seasons: [season('2026-08')] },
      { clanTag: '#BBB', seasons: [season('2026-08-03')] }
    ])

    expect(selection?.season).toBe('2026-08-03')
  })
})
