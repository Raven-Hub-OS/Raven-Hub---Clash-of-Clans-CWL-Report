import { describe, expect, it } from 'vitest'
import { isAllowedExternalUrl } from './external'

describe('isAllowedExternalUrl', () => {
  it('allows ClashKing, Supercell and Raven Hub destinations', () => {
    expect(isAllowedExternalUrl('https://clashk.ing')).toBe(true)
    expect(isAllowedExternalUrl('https://docs.clashk.ing/clan-setups/add-a-clan')).toBe(true)
    expect(isAllowedExternalUrl('https://www.supercell.com/fan-content-policy')).toBe(true)
    expect(isAllowedExternalUrl('https://discord.gg/CjHv7Jpk5d')).toBe(true)
    expect(isAllowedExternalUrl('https://ravenhub.store')).toBe(true)
    expect(isAllowedExternalUrl('https://www.ravenhub.store/shop')).toBe(true)
  })

  it('rejects unknown hosts, http URLs and malformed URLs', () => {
    expect(isAllowedExternalUrl('https://example.com')).toBe(false)
    expect(isAllowedExternalUrl('http://ravenhub.store')).toBe(false)
    expect(isAllowedExternalUrl('https://ravenhub.store.example.com')).toBe(false)
    expect(isAllowedExternalUrl('not a url')).toBe(false)
  })
})
