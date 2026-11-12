import { describe, expect, it } from 'vitest'
import { defaultRosterName } from './library'

describe('defaultRosterName', () => {
  it('does not repeat the season when the source report already starts with it', () => {
    expect(defaultRosterName('August 2026', 'August 2026 · 2 clans')).toBe(
      'August 2026 · 2 clans · Roster'
    )
  })

  it('prefixes the season for reports with a custom name', () => {
    expect(defaultRosterName('August 2026', 'CWL prep')).toBe(
      'August 2026 · CWL prep · Roster'
    )
  })

  it('clamps long names to the library limit', () => {
    const name = defaultRosterName('August 2026', 'x'.repeat(200))

    expect(name).toHaveLength(120)
    expect(name.endsWith('…')).toBe(true)
  })
})
