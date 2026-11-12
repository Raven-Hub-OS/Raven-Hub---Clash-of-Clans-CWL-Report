import { describe, expect, it } from 'vitest'
import {
  formatSeasonLabel,
  seasonFileFragment,
  seasonKey,
  seasonSortValue
} from './seasons'

describe('seasonKey', () => {
  it('reduces both ClashKing season formats to a month key', () => {
    expect(seasonKey('2026-08-03')).toBe('2026-08')
    expect(seasonKey('2024-12')).toBe('2024-12')
  })

  it('keeps unknown formats intact', () => {
    expect(seasonKey('Season 42')).toBe('Season 42')
  })
})

describe('seasonSortValue', () => {
  it('sorts newer seasons higher', () => {
    expect(seasonSortValue('2026-08-03')).toBeGreaterThan(seasonSortValue('2026-07-01'))
    expect(seasonSortValue('2026-08')).toBeGreaterThan(seasonSortValue('2025-12'))
  })

  it('returns zero for unknown formats', () => {
    expect(seasonSortValue('unknown')).toBe(0)
  })
})

describe('formatSeasonLabel', () => {
  it('formats the month and year in English', () => {
    expect(formatSeasonLabel('2026-08-03')).toBe('August 2026')
    expect(formatSeasonLabel('2024-12')).toBe('December 2024')
  })
})

describe('seasonFileFragment', () => {
  it('produces a safe file name fragment', () => {
    expect(seasonFileFragment('2026-08-03')).toBe('2026-08')
    expect(seasonFileFragment('weird season/name')).toBe('weird-season-name')
  })
})
