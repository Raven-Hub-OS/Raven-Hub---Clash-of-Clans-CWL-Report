export function missedTone(missed: number): string {
  if (missed === 0) return 'metric-good'
  if (missed === 1) return 'metric-warn'
  return 'metric-bad'
}

export function avgStarsTone(avgStars: number, attacks: number): string {
  if (attacks === 0) return 'metric-muted'
  if (avgStars >= 2.999) return 'metric-great'
  if (avgStars >= 2.85) return 'metric-good'
  if (avgStars >= 2.5) return 'metric-warn'
  return 'metric-bad'
}

export function attackStarsTone(stars: number, wars: number, missed: number): string {
  if (wars === 0) return 'metric-muted'
  const gap = wars * 3 - stars
  if (gap <= 0 && missed === 0) return 'metric-great'
  if (gap <= 2) return 'metric-good'
  if (gap <= 4) return 'metric-warn'
  return 'metric-bad'
}

export function destructionTone(destruction: number, attacks: number): string {
  if (attacks === 0) return 'metric-muted'
  const ratio = destruction / (attacks * 100)
  if (ratio >= 0.9999) return 'metric-great'
  if (ratio >= 0.98) return 'metric-good'
  if (ratio >= 0.97) return 'metric-warn'
  return 'metric-bad'
}

export function avgDefenseTone(avgDefense: number, defenses: number): string {
  if (defenses === 0) return 'metric-muted'
  if (avgDefense >= 2.999) return 'metric-bad'
  if (avgDefense >= 2.6) return 'metric-warn'
  return 'metric-good'
}
