import { app, BrowserWindow, Menu, shell, ipcMain } from 'electron'
import { existsSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import { APP_NAME } from '@shared/app'
import { IPC_CHANNELS } from '@shared/types'
import { registerIpcHandlers } from './ipc'
import { isAllowedExternalUrl } from './external'
import { autoUpdater } from 'electron-updater'

const APP_ID = 'com.ravenhub.cwlreport'
const LEGACY_PRODUCT_NAME = 'Raven Hub - Clash of Clans CWL Report'

let mainWindow: BrowserWindow | null = null

// The product was renamed, which moves Electron's userData folder. Move the old
// settings/library/cache over once so existing installs keep their reports.
function migrateLegacyUserData(): void {
  const currentDir = app.getPath('userData')
  if (currentDir.endsWith(LEGACY_PRODUCT_NAME)) return

  const legacyDir = join(app.getPath('appData'), LEGACY_PRODUCT_NAME)
  if (existsSync(currentDir) || !existsSync(legacyDir)) return

  try {
    renameSync(legacyDir, currentDir)
  } catch {
    // If the move fails, keep the new location; old data stays untouched.
  }
}

migrateLegacyUserData()

function checkForUpdates(): void {
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) return

  autoUpdater.checkForUpdatesAndNotify()

  autoUpdater.on('checking-for-update', () => {
    mainWindow?.webContents.send('update-checking')
  })

  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('update-available', info)
  })

  autoUpdater.on('update-not-available', () => {
    mainWindow?.webContents.send('update-not-available')
  })

  autoUpdater.on('download-progress', (progress) => {
    mainWindow?.webContents.send('update-download-progress', progress)
  })

  autoUpdater.on('update-downloaded', (info) => {
    mainWindow?.webContents.send('update-downloaded', info)
  })

  autoUpdater.on('error', (err) => {
    mainWindow?.webContents.send('update-error', err.message ?? String(err))
  })
}

ipcMain.handle(IPC_CHANNELS.updateInstall, () => {
  void autoUpdater.quitAndInstall()
})

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 980,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0b0d12',
    title: APP_NAME,
    icon: app.isPackaged
      ? join(process.resourcesPath, 'icon.ico')
      : join(__dirname, '../../build/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false
    }
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) {
      void shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== mainWindow?.webContents.getURL()) {
      event.preventDefault()
      if (isAllowedExternalUrl(url)) void shell.openExternal(url)
    }
  })

  mainWindow.webContents.on('will-attach-webview', (event) => {
    event.preventDefault()
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  app.setAppUserModelId(APP_ID)
  Menu.setApplicationMenu(null)
  registerIpcHandlers()
  createWindow()
  checkForUpdates()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
