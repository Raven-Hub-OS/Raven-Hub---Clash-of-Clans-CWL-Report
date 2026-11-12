import { contextBridge, ipcRenderer } from 'electron'
import type { RosterDraft } from '@shared/types'
import { IPC_CHANNELS, type ProgressEvent } from '@shared/types'

const api = {
  generateReport: (tags: string[]) => ipcRenderer.invoke(IPC_CHANNELS.generate, { tags }),
  cancelReport: () => ipcRenderer.invoke(IPC_CHANNELS.cancel),
  saveXlsx: (reportId: string) => ipcRenderer.invoke(IPC_CHANNELS.save, { reportId }),
  openExternal: (url: string) => ipcRenderer.invoke(IPC_CHANNELS.openExternal, { url }),
  showItemInFolder: (filePath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.showItem, { filePath }),
  getAppInfo: () => ipcRenderer.invoke(IPC_CHANNELS.appInfo),
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.settingsGet),
  setLastFolder: (kind: 'report' | 'roster', folderId: string | null) =>
    ipcRenderer.invoke(IPC_CHANNELS.settingsSetLastFolder, { kind, folderId }),
  getLibrary: () => ipcRenderer.invoke(IPC_CHANNELS.libraryGet),
  createLibraryFolder: (name: string, parentId: string | null) =>
    ipcRenderer.invoke(IPC_CHANNELS.libraryCreateFolder, { name, parentId }),
  renameLibraryFolder: (id: string, name: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.libraryRenameFolder, { id, name }),
  deleteLibraryFolder: (id: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.libraryDeleteFolder, { id }),
  moveLibraryFolder: (id: string, parentId: string | null, index: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.libraryMoveFolder, { id, parentId, index }),
  renameLibraryItem: (id: string, name: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.libraryRenameItem, { id, name }),
  moveLibraryItem: (id: string, folderId: string | null, index: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.libraryMoveItem, { id, folderId, index }),
  deleteLibraryItem: (id: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.libraryDeleteItem, { id }),
  saveReportToLibrary: (reportId: string, name: string, folderId: string | null) =>
    ipcRenderer.invoke(IPC_CHANNELS.librarySaveReport, { reportId, name, folderId }),
  getLibraryReport: (id: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.libraryGetReport, { id }),
  exportLibraryReport: (id: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.libraryExportReport, { id }),
  saveRosterToLibrary: (draft: RosterDraft) =>
    ipcRenderer.invoke(IPC_CHANNELS.librarySaveRoster, draft),
  getLibraryRoster: (id: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.libraryGetRoster, { id }),
  exportRoster: (draft: RosterDraft) =>
    ipcRenderer.invoke(IPC_CHANNELS.libraryExportRoster, draft),
  loadRosterClan: (tag: string, seasonKey: string | null) =>
    ipcRenderer.invoke(IPC_CHANNELS.rosterLoadClan, { tag, seasonKey }),
  onProgress: (callback: (event: ProgressEvent) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: ProgressEvent): void => {
      callback(progress)
    }
    ipcRenderer.on(IPC_CHANNELS.progress, listener)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.progress, listener)
    }
  },
  onUpdateChecking: (callback: () => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent): void => {
      callback()
    }
    ipcRenderer.on('update-checking', listener)
    return () => {
      ipcRenderer.removeListener('update-checking', listener)
    }
  },
  onUpdateAvailable: (callback: (info: unknown) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, info: unknown): void => {
      callback(info)
    }
    ipcRenderer.on('update-available', listener)
    return () => {
      ipcRenderer.removeListener('update-available', listener)
    }
  },
  onUpdateNotAvailable: (callback: () => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent): void => {
      callback()
    }
    ipcRenderer.on('update-not-available', listener)
    return () => {
      ipcRenderer.removeListener('update-not-available', listener)
    }
  },
  onUpdateDownloadProgress: (callback: (progress: unknown) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: unknown): void => {
      callback(progress)
    }
    ipcRenderer.on('update-download-progress', listener)
    return () => {
      ipcRenderer.removeListener('update-download-progress', listener)
    }
  },
  onUpdateDownloaded: (callback: (info: unknown) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, info: unknown): void => {
      callback(info)
    }
    ipcRenderer.on('update-downloaded', listener)
    return () => {
      ipcRenderer.removeListener('update-downloaded', listener)
    }
  },
  onUpdateError: (callback: (message: string) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, message: string): void => {
      callback(message)
    }
    ipcRenderer.on('update-error', listener)
    return () => {
      ipcRenderer.removeListener('update-error', listener)
    }
  },
  installUpdate: () => ipcRenderer.invoke(IPC_CHANNELS.updateInstall)
}

contextBridge.exposeInMainWorld('raven', api)
