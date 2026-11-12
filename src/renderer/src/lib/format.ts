const integerFormatter = new Intl.NumberFormat('en-US')

export function formatInt(value: number): string {
  return integerFormatter.format(Number.isFinite(value) ? value : 0)
}

export function formatDecimal(value: number, digits = 2): string {
  return Number.isFinite(value) ? value.toFixed(digits) : (0).toFixed(digits)
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date)
}
