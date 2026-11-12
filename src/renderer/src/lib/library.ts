import type {
  LibraryFolder,
  LibraryItem,
  LibraryReportItem,
  LibraryRosterItem,
  ReportData
} from '@shared/types'

export interface FolderOption {
  id: string
  name: string
  label: string
  depth: number
}

export function childFolders(
  folders: LibraryFolder[],
  parentId: string | null
): LibraryFolder[] {
  return folders
    .filter((folder) => folder.parentId === parentId)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'en'))
}

export function folderItems(items: LibraryItem[], folderId: string | null): LibraryItem[] {
  return items
    .filter((item) => item.folderId === folderId)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'en'))
}

export function folderChain(
  folders: LibraryFolder[],
  folderId: string | null
): LibraryFolder[] {
  if (!folderId) return []
  const chain: LibraryFolder[] = []
  let current = folders.find((folder) => folder.id === folderId)
  const seen = new Set<string>()

  while (current && !seen.has(current.id)) {
    seen.add(current.id)
    chain.unshift(current)
    current = current.parentId
      ? folders.find((folder) => folder.id === current?.parentId)
      : undefined
  }

  return chain
}

export function folderLabel(folders: LibraryFolder[], folderId: string | null): string {
  if (!folderId) return 'Reports'
  const chain = folderChain(folders, folderId)
  return chain.length > 0 ? chain.map((folder) => folder.name).join(' / ') : 'Reports'
}

export function flattenFolderOptions(
  folders: LibraryFolder[],
  includeRoot = true
): FolderOption[] {
  const options: FolderOption[] = includeRoot
    ? [{ id: '', name: 'Reports', label: 'Reports', depth: 0 }]
    : []

  const walk = (parentId: string | null, depth: number): void => {
    for (const folder of childFolders(folders, parentId)) {
      options.push({
        id: folder.id,
        name: folder.name,
        label: `${'  '.repeat(depth)}${folder.name}`,
        depth
      })
      walk(folder.id, depth + 1)
    }
  }

  walk(null, includeRoot ? 1 : 0)
  return options
}

export function isFolderDescendant(
  folders: LibraryFolder[],
  candidateId: string,
  ancestorId: string
): boolean {
  let current = folders.find((folder) => folder.id === candidateId)
  const seen = new Set<string>()

  while (current?.parentId && !seen.has(current.id)) {
    seen.add(current.id)
    if (current.parentId === ancestorId) return true
    current = folders.find((folder) => folder.id === current?.parentId)
  }

  return false
}

export function reportsOnly(items: LibraryItem[]): LibraryReportItem[] {
  return items.filter((item): item is LibraryReportItem => item.type === 'report')
}

export function rostersOnly(items: LibraryItem[]): LibraryRosterItem[] {
  return items.filter((item): item is LibraryRosterItem => item.type === 'roster')
}

export function itemMeta(item: LibraryItem): string {
  if (item.type === 'report') {
    return `${item.seasonLabel} · ${item.clanCount} clan${item.clanCount === 1 ? '' : 's'} · ${item.playerCount} player${item.playerCount === 1 ? '' : 's'}`
  }
  return `${item.seasonLabel} · ${item.playerCount} player${item.playerCount === 1 ? '' : 's'}`
}

export function defaultReportName(report: ReportData): string {
  const clans = report.clans.length
  return `${report.seasonLabel} · ${clans} clan${clans === 1 ? '' : 's'}`
}

export function defaultRosterName(seasonLabel: string, sourceName: string): string {
  const trimmed = sourceName.trim()
  const base = trimmed.toLowerCase().startsWith(seasonLabel.toLowerCase())
    ? trimmed
    : `${seasonLabel} · ${trimmed}`
  const name = `${base} · Roster`
  return name.length > 120 ? `${name.slice(0, 119)}…` : name
}
