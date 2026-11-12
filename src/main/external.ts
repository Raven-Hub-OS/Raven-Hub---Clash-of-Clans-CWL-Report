const ALLOWED_HOSTS = new Set([
  'clashk.ing',
  'www.clashk.ing',
  'docs.clashk.ing',
  'invite.clashk.ing',
  'api.clashk.ing',
  'supercell.com',
  'www.supercell.com',
  'developer.clashofclans.com',
  'discord.gg',
  'ravenhub.store',
  'www.ravenhub.store'
])

export function isAllowedExternalUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl)
    if (url.protocol !== 'https:') return false
    return ALLOWED_HOSTS.has(url.hostname.toLowerCase())
  } catch {
    return false
  }
}
