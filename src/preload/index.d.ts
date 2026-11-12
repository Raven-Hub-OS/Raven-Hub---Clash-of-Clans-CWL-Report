import type {
  AppInfo,
  AppSettings,
  GenerateResponse,
  LibraryFolder,
  LibraryItem,
  LibrarySnapshot,
  ProgressEvent,
  ReportData,
  RosterClanLoadResponse,
  RosterDraft,
  RosterSnapshot,
  SaveResponse
} from '../shared/types'

export interface RavenApi {
  generateReport: (tags: string[]) => Promise<GenerateResponse>
  cancelReport: () => Promise<boolean>
  saveXlsx: (reportId: string) => Promise<SaveResponse>
  openExternal: (url: string) => Promise<boolean>
  showItemInFolder: (filePath: string) => Promise<boolean>
  getAppInfo: () => Promise<AppInfo>
  getSettings: () => Promise<AppSettings>
  setLastFolder: (kind: 'report' | 'roster', folderId: string | null) => Promise<AppSettings>
  getLibrary: () => Promise<LibrarySnapshot>
  createLibraryFolder: (name: string, parentId: string | null) => Promise<LibraryFolder>
  renameLibraryFolder: (id: string, name: string) => Promise<LibraryFolder>
  deleteLibraryFolder: (id: string) => Promise<boolean>
  moveLibraryFolder: (id: string, parentId: string | null, index: number) => Promise<boolean>
  renameLibraryItem: (id: string, name: string) => Promise<LibraryItem>
  moveLibraryItem: (id: string, folderId: string | null, index: number) => Promise<boolean>
  deleteLibraryItem: (id: string) => Promise<boolean>
  saveReportToLibrary: (
    reportId: string,
    name: string,
    folderId: string | null
  ) => Promise<LibraryItem>
  getLibraryReport: (id: string) => Promise<ReportData>
  exportLibraryReport: (id: string) => Promise<SaveResponse>
  saveRosterToLibrary: (draft: RosterDraft) => Promise<LibraryItem>
  getLibraryRoster: (id: string) => Promise<RosterSnapshot>
  exportRoster: (draft: RosterDraft) => Promise<SaveResponse>
  loadRosterClan: (tag: string, seasonKey: string | null) => Promise<RosterClanLoadResponse>
  onProgress: (callback: (event: ProgressEvent) => void) => () => void
  onUpdateChecking: (callback: () => void) => () => void
  onUpdateAvailable: (callback: (info: unknown) => void) => () => void
  onUpdateNotAvailable: (callback: () => void) => () => void
  onUpdateDownloadProgress: (callback: (progress: unknown) => void) => () => void
  onUpdateDownloaded: (callback: (info: unknown) => void) => () => void
  onUpdateError: (callback: (message: string) => void) => () => void
  installUpdate: () => Promise<void>
}

declare global {
  interface Window {
    raven: RavenApi
  }
}

export {}
