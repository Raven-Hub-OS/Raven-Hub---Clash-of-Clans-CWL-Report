import { describe, expect, it } from 'vitest'
import { normalizeTag, parseTags } from './tags'

describe('normalizeTag', () => {
  it('adds the hash and uppercases the tag', () => {
    expect(normalizeTag('2ylccll0y')).toBe('#2YLCCLL0Y')
    expect(normalizeTag('  #2YLCCLL0Y ')).toBe('#2YLCCLL0Y')
  })

  it('accepts tags without a leading hash', () => {
    expect(normalizeTag('GCQL0029')).toBe('#GCQL0029')
  })

  it('rejects empty, too short and invalid characters', () => {
    expect(normalizeTag('')).toBeNull()
    expect(normalizeTag('#')).toBeNull()
    expect(normalizeTag('#AB')).toBeNull()
    expect(normalizeTag('#ABC-123')).toBeNull()
    expect(normalizeTag('#ÁBC1234')).toBeNull()
  })

  it('rejects tags longer than 12 characters', () => {
    expect(normalizeTag('#1234567890123')).toBeNull()
  })
})

describe('parseTags', () => {
  it('parses newline, comma, semicolon and whitespace separated tags', () => {
    const result = parseTags('#2YLCCLL0Y\nGCQL0029, #U290P80P; 9P2YV8YQ')

    expect(result.tags).toEqual(['#2YLCCLL0Y', '#GCQL0029', '#U290P80P', '#9P2YV8YQ'])
    expect(result.invalid).toEqual([])
    expect(result.duplicateCount).toBe(0)
  })

  it('deduplicates case-insensitively and counts duplicates', () => {
    const result = parseTags('#2YLCCLL0Y 2ylccll0y #2YLCCLL0Y')

    expect(result.tags).toEqual(['#2YLCCLL0Y'])
    expect(result.duplicateCount).toBe(2)
  })

  it('reports invalid tokens while keeping valid tags', () => {
    const result = parseTags('#2YLCCLL0Y no! #GCQL0029')

    expect(result.tags).toEqual(['#2YLCCLL0Y', '#GCQL0029'])
    expect(result.invalid).toEqual(['no!'])
  })

  it('ignores extra whitespace and blank input', () => {
    expect(parseTags('   \n\t  ')).toEqual({ tags: [], invalid: [], duplicateCount: 0 })
  })
})
