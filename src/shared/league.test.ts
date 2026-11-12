import { describe, expect, it } from 'vitest'
import { makePlayer } from '../main/domain/testFixtures'
import {
  compareLeagues,
  leagueLabel,
  leagueSortValue,
  parseLeague,
  sortClansByLeague,
  sortPlayersByLeague
} from './league'

describe('parseLeague', () => {
  it('reads the tier and division', () => {
    expect(parseLeague('Champion League III')).toEqual({ tier: 5, division: 3 })
    expect(parseLeague('Crystal League I')).toEqual({ tier: 3, division: 1 })
    expect(parseLeague('master league ii')).toEqual({ tier: 4, division: 2 })
  })

  it('accepts names without the word League and Legend without a division', () => {
    expect(parseLeague('Titan I')).toEqual({ tier: 6, division: 1 })
    expect(parseLeague('Legend League')).toEqual({ tier: 7, division: null })
  })

  it('returns null for empty or unknown leagues', () => {
    expect(parseLeague(null)).toBeNull()
    expect(parseLeague('')).toBeNull()
    expect(parseLeague('Clan Capital')).toBeNull()
  })
})

describe('league ordering', () => {
  it('puts Legend first and unknown leagues last', () => {
    expect(leagueSortValue('Legend League')).toBeGreaterThan(leagueSortValue('Titan League I'))
    expect(leagueSortValue('Titan League I')).toBeGreaterThan(leagueSortValue('Titan League III'))
    expect(leagueSortValue('Titan League III')).toBeGreaterThan(leagueSortValue('Champion League I'))
    expect(leagueSortValue('Champion League III')).toBeGreaterThan(leagueSortValue('Bronze League III'))
    expect(leagueSortValue('Bronze League III')).toBeGreaterThan(leagueSortValue(null))
  })

  it('compares strongest first', () => {
    expect(compareLeagues('Legend League', 'Champion League I')).toBeLessThan(0)
    expect(compareLeagues('Champion League I', 'Legend League')).toBeGreaterThan(0)
    expect(compareLeagues('Gold League II', 'Gold League II')).toBe(0)
  })

  it('labels missing leagues as Unranked', () => {
    expect(leagueLabel(' Legend League ')).toBe('Legend League')
    expect(leagueLabel(null)).toBe('Unranked')
  })
})

describe('sortClansByLeague', () => {
  it('orders sections by league and then name', () => {
    const clans = [
      { name: 'Bronze Clan', league: 'Bronze League I' },
      { name: 'Legend Clan', league: 'Legend League' },
      { name: 'Titan B', league: 'Titan League II' },
      { name: 'Titan A', league: 'Titan League II' },
      { name: 'Unknown', league: null }
    ]

    expect(sortClansByLeague(clans).map((clan) => clan.name)).toEqual([
      'Legend Clan',
      'Titan A',
      'Titan B',
      'Bronze Clan',
      'Unknown'
    ])
  })

  it('does not mutate the input', () => {
    const clans = [
      { name: 'Bronze Clan', league: 'Bronze League I' },
      { name: 'Legend Clan', league: 'Legend League' }
    ]

    const sorted = sortClansByLeague(clans)

    expect(sorted).not.toBe(clans)
    expect(clans[0].name).toBe('Bronze Clan')
  })
})

describe('sortPlayersByLeague', () => {
  it('groups players by their clan league and keeps the original order inside a league', () => {
    const players = [
      makePlayer({ name: 'Bronze One', clanTag: '#BRONZE', clan: 'Bronze Clan' }),
      makePlayer({ name: 'Legend One', tag: '#LEGEND1', clanTag: '#LEGEND', clan: 'Legend Clan' }),
      makePlayer({ name: 'Bronze Two', tag: '#BRONZE2', clanTag: '#BRONZE', clan: 'Bronze Clan' }),
      makePlayer({ name: 'Legend Two', tag: '#LEGEND2', clanTag: '#LEGEND', clan: 'Legend Clan' })
    ]

    const sorted = sortPlayersByLeague(players, [
      { tag: '#BRONZE', league: 'Bronze League I' },
      { tag: '#LEGEND', league: 'Legend League' }
    ])

    expect(sorted.map((player) => player.name)).toEqual([
      'Legend One',
      'Legend Two',
      'Bronze One',
      'Bronze Two'
    ])
    expect(sorted).not.toBe(players)
  })
})
