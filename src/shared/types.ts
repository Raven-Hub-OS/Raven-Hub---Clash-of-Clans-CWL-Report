export interface PlayerRow {
  clanTag: string
  clan: string
  name: string
  /** Full player tag, including the leading '#'. */
  tag: string
  th: number
  warsParticipated: number
  attacks: number
  missed: number
  attackStars: number
  avgStars: number
  destruction: number
  defenses: number
  defenseStars: number
  avgDefense: number
  reaches: number
  dips: number
}

export interface ReportClan {
  tag: string
  name: string
  season: string
  league: string | null
  rank: number | null
  stars: number | null
  destruction: number | null
  rounds: { won: number; tied: number; lost: number } | null
  players: number
}

export type WarningKind =
  | 'untracked'
  | 'no-ended-season'
  | 'missing-season'
  | 'fetch-error'
  | 'partial-war'
  | 'sanity'
  | 'incomplete-data'
  | 'no-players'

export interface ReportWarning {
  kind: WarningKind
  clanTag?: string
  clanName?: string
  message: string
  detail?: string
}

export interface ReportStats {
  clans: number
  players: number
  attacks: number
  missed: number
  attackStars: number
  defenses: number
  avgStars: number
  avgDefense: number
}

export interface ReportData {
  reportId: string
  season: string
  seasonKey: string
  seasonLabel: string
  generatedAt: string
  clans: ReportClan[]
  players: PlayerRow[]
  warnings: ReportWarning[]
  stats: ReportStats
}

export interface ApiError {
  code: string
  message: string
}

export type GenerateResponse =
  | { ok: true; report: ReportData }
  | { ok: false; error: ApiError }

export interface SaveResponse {
  canceled: boolean
  filePath?: string
}

export interface AppInfo {
  name: string
  version: string
  platform: string
  cachePath: string
  libraryPath: string
}

export interface AppSettings {
  version: 1
  lastTags: string[]
  lastReportFolderId: string | null
  lastRosterFolderId: string | null
}

export interface LibraryFolder {
  id: string
  name: string
  parentId: string | null
  order: number
  createdAt: string
  updatedAt: string
}

export interface LibraryItemBase {
  id: string
  name: string
  folderId: string | null
  order: number
  createdAt: string
  updatedAt: string
}

export interface LibraryReportItem extends LibraryItemBase {
  type: 'report'
  reportId: string
  seasonLabel: string
  clanCount: number
  playerCount: number
}

export interface LibraryRosterItem extends LibraryItemBase {
  type: 'roster'
  sourceReportItemId: string | null
  sourceReportName: string
  seasonLabel: string
  playerCount: number
}

export type LibraryItem = LibraryReportItem | LibraryRosterItem

export interface LibrarySnapshot {
  folders: LibraryFolder[]
  items: LibraryItem[]
}

export interface RosterClan {
  tag: string
  name: string
  league: string | null
}

export interface RosterClanLoadResponse {
  clan: RosterClan
  players: PlayerRow[]
  seasonKey: string
}

export interface RosterDraft {
  id?: string
  name: string
  folderId: string | null
  sourceReportItemId: string | null
  sourceReportName: string
  seasonLabel: string
  seasonKey?: string | null
  clans?: RosterClan[]
  extraPlayers?: PlayerRow[]
  players: PlayerRow[]
}

export interface RosterSnapshot {
  version: 1
  id: string
  name: string
  sourceReportItemId: string | null
  sourceReportName: string
  seasonLabel: string
  seasonKey: string | null
  clans: RosterClan[]
  extraPlayers: PlayerRow[]
  players: PlayerRow[]
  createdAt: string
  updatedAt: string
}

export type ProgressPhase = 'seasons' | 'groups' | 'aggregate' | 'done'

export interface ProgressEvent {
  phase: ProgressPhase
  current: number
  total: number
  clanTag?: string
  clanName?: string
  message: string
}

export interface GenerateRequest {
  tags: string[]
}

export const IPC_CHANNELS = {
  generate: 'report:generate',
  cancel: 'report:cancel',
  save: 'report:save',
  progress: 'report:progress',
  openExternal: 'shell:open-external',
  showItem: 'shell:show-item',
  appInfo: 'app:info',
  settingsGet: 'settings:get',
  settingsSetLastFolder: 'settings:set-last-folder',
  libraryGet: 'library:get',
  libraryCreateFolder: 'library:create-folder',
  libraryRenameFolder: 'library:rename-folder',
  libraryDeleteFolder: 'library:delete-folder',
  libraryMoveFolder: 'library:move-folder',
  libraryRenameItem: 'library:rename-item',
  libraryMoveItem: 'library:move-item',
  libraryDeleteItem: 'library:delete-item',
  librarySaveReport: 'library:save-report',
  libraryGetReport: 'library:get-report',
  libraryExportReport: 'library:export-report',
  librarySaveRoster: 'library:save-roster',
  libraryGetRoster: 'library:get-roster',
  libraryExportRoster: 'library:export-roster',
  rosterLoadClan: 'roster:load-clan'
} as const

export const MAX_CLANS = 20
