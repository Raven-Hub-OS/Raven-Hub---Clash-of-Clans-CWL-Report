export function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) return 'Something went wrong. Please try again.'

  return error.message
    .replace(/^Error invoking remote method '[^']+':\s*/, '')
    .replace(/^Error:\s*/, '')
}
