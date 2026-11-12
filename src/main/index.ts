import { app, BrowserWindow, Menu, shell, ipcMain } from 'electron'
import { join } from 'node:path'
import { APP_NAME } from '@shared/app'
import { IPC_CHANNELS } from '@shared/types'
import { registerIpcHandlers } from './ipc'
import { isAllowedExternalUrl } from './external'
import { autoUpdater } from 'electron-updater'

const APP_ID = 'com.ravenhub.cwlreport'

let mainWindow: BrowserWindow | null = null

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
