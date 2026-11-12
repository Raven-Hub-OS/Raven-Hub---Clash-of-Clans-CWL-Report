export const MAX_TAGS = 20

/**
 * Accepts tags with or without a leading '#', lower or upper case, and
 * returns the canonical Clash of Clans form: '#ABC123'.
 */
export function normalizeTag(input: string): string | null {
  const cleaned = input
    .trim()
    .replace(/\s+/g, '')
    .replace(/^#+/, '')
    .toUpperCase()

  if (!/^[0-9A-Z]{3,12}$/.test(cleaned)) return null
  return `#${cleaned}`
}

export interface ParsedTags {
  tags: string[]
  invalid: string[]
  duplicateCount: number
}

/**
 * Splits on new lines, commas, semicolons and whitespace. Preserves the order
 * of first appearance and removes duplicates.
 */
export function parseTags(input: string): ParsedTags {
  const tokens = input
    .split(/[\s,;]+/)
    .map((token) => token.trim())
    .filter(Boolean)

  const tags: string[] = []
  const invalid: string[] = []
  const seen = new Set<string>()
  let duplicateCount = 0

  for (const token of tokens) {
    const tag = normalizeTag(token)
    if (!tag) {
      invalid.push(token)
      continue
    }
    if (seen.has(tag)) {
      duplicateCount += 1
      continue
    }
    seen.add(tag)
    tags.push(tag)
  }

  return { tags, invalid, duplicateCount }
}
