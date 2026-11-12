import { useCallback, useEffect, useMemo, useState, type JSX } from 'react'
import {
  APP_NAME,
  RAVEN_HUB_DISCORD_URL,
  RAVEN_HUB_WEBSITE_URL
} from '@shared/app'
import type {
  AppInfo,
  AppSettings,
  LibraryReportItem,
  LibraryRosterItem,
  ProgressEvent,
  ReportData
} from '@shared/types'
import { parseTags } from '@shared/tags'
import { Header, type PrimaryTab } from './components/Header'
import { Home } from './components/Home'
import { LoadingView } from './components/LoadingView'
import { ReportView } from './components/ReportView'
import { Modal } from './components/Modal'
import { AboutModal } from './components/AboutModal'
import { TrackingModal } from './components/TrackingModal'
import { Toast, type ToastData } from './components/Toast'
import { LibraryView } from './components/LibraryView'
import { RosterMakerView } from './components/RosterMakerView'
import { SaveReportModal } from './components/SaveReportModal'
import { DiscordIcon, GlobeIcon } from './components/Icons'
import { errorMessage } from './lib/errors'

type View = 'home' | 'loading' | 'report'
type ModalName = 'about' | 'tracking' | null

interface LibraryReportPreview {
  item: LibraryReportItem
  report: ReportData
}

interface RosterRequest {
  id: string
  token: number
}

export default function App(): JSX.Element {
  const [tab, setTab] = useState<PrimaryTab>('home')
  const [view, setView] = useState<View>('home')
  const [tagsInput, setTagsInput] = useState('')
  const [report, setReport] = useState<ReportData | null>(null)
  const [progress, setProgress] = useState<ProgressEvent | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [modal, setModal] = useState<ModalName>(null)
  const [toast, setToast] = useState<ToastData | null>(null)
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null)
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [canceling, setCanceling] = useState(false)
  const [saving, setSaving] = useState(false)
  const [libraryVersion, setLibraryVersion] = useState(0)
  const [libraryReport, setLibraryReport] = useState<LibraryReportPreview | null>(null)
  const [saveReportOpen, setSaveReportOpen] = useState(false)
  const [rosterRequest, setRosterRequest] = useState<RosterRequest | null>(null)

  const parsed = useMemo(() => parseTags(tagsInput), [tagsInput])

  useEffect(() => {
    return window.raven.onProgress((event) => setProgress(event))
  }, [])

  useEffect(() => {
    let active = true
    Promise.all([window.raven.getAppInfo(), window.raven.getSettings()])
      .then(([info, stored]) => {
        if (!active) return
        setAppInfo(info)
        setSettings(stored)
        if (stored.lastTags.length > 0) {
          setTagsInput((current) => (current.trim() ? current : stored.lastTags.join('\n')))
        }
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 7000)
    return () => window.clearTimeout(timer)
  }, [toast])

  const handleNavigate = (next: PrimaryTab): void => {
    if (next === 'reports') setLibraryReport(null)
    if (next === 'roster') setLibraryVersion((current) => current + 1)
    setTab(next)
  }

  const handleGenerate = async (): Promise<void> => {
    if (parsed.tags.length === 0) {
      setError('Add at least one clan tag to generate a report.')
      return
    }
    if (parsed.invalid.length > 0) {
      const preview = parsed.invalid.slice(0, 4).join(', ')
      setError(
        `Fix or remove these tags: ${preview}${
          parsed.invalid.length > 4 ? ` and ${parsed.invalid.length - 4} more` : ''
        }.`
      )
      return
    }

    setError(null)
    setReport(null)
    setProgress(null)
    setView('loading')

    try {
      const result = await window.raven.generateReport(parsed.tags)
      if (result.ok) {
        setReport(result.report)
        setView('report')
      } else {
        setView('home')
        if (result.error.code !== 'cancelled') setError(result.error.message)
      }
    } catch {
      setView('home')
      setError('Something went wrong while building the report. Please try again.')
    } finally {
      setCanceling(false)
    }
  }

  const handleCancel = async (): Promise<void> => {
    setCanceling(true)
    try {
      await window.raven.cancelReport()
    } catch {
      setCanceling(false)
      setToast({
        kind: 'error',
        title: 'Could not cancel',
        message: 'The report may still be running. Try again in a moment.'
      })
    }
  }

  const handleSave = async (): Promise<void> => {
    if (!report) return
    setSaving(true)
    try {
      const result = await window.raven.saveXlsx(report.reportId)
      if (!result.canceled && result.filePath) {
        setToast({
          kind: 'success',
          title: 'Workbook saved',
          message: result.filePath,
          filePath: result.filePath
        })
      }
    } catch (saveError) {
      setToast({
        kind: 'error',
        title: 'Could not save the workbook',
        message: errorMessage(saveError)
      })
    } finally {
      setSaving(false)
    }
  }

  const handleExportLibraryReport = async (): Promise<void> => {
    if (!libraryReport) return
    setSaving(true)
    try {
      const result = await window.raven.exportLibraryReport(libraryReport.item.id)
      if (!result.canceled && result.filePath) {
        setToast({
          kind: 'success',
          title: 'Workbook exported',
          message: result.filePath,
          filePath: result.filePath
        })
      }
    } catch (exportError) {
      setToast({
        kind: 'error',
        title: 'Could not export the report',
        message: errorMessage(exportError)
      })
    } finally {
      setSaving(false)
    }
  }

  const handleSaveReportToLibrary = async (
    name: string,
    folderId: string | null
  ): Promise<void> => {
    if (!report) throw new Error('Generate a report before saving it to the library.')

    await window.raven.saveReportToLibrary(report.reportId, name, folderId)
    setSaveReportOpen(false)
    setLibraryVersion((current) => current + 1)
    setSettings((current) =>
      current ? { ...current, lastReportFolderId: folderId } : current
    )
    setToast({ kind: 'success', title: 'Report saved to library', message: name })
  }

  const handleNew = (): void => {
    setView('home')
    setReport(null)
    setProgress(null)
    setError(null)
  }

  const handleOpenLibraryReport = (item: LibraryReportItem, saved: ReportData): void => {
    setLibraryReport({ item, report: saved })
    setTab('reports')
  }

  const handleOpenRoster = (item: LibraryRosterItem): void => {
    setRosterRequest((current) => ({ id: item.id, token: (current?.token ?? 0) + 1 }))
    setTab('roster')
  }

  const handleRosterRequestHandled = useCallback((): void => {
    setRosterRequest(null)
  }, [])

  const handleLibraryChanged = useCallback((): void => {
    setLibraryVersion((current) => current + 1)
  }, [])

  const handleCopyTag = async (tag: string): Promise<void> => {
    try {
      await copyText(tag)
      setToast({ kind: 'success', title: 'Tag copied', message: tag })
    } catch {
      setToast({ kind: 'error', title: 'Could not copy the tag', message: tag })
    }
  }

  const handleShowItem = async (filePath: string): Promise<void> => {
    try {
      await window.raven.showItemInFolder(filePath)
    } catch {
      setToast({
        kind: 'error',
        title: 'Could not open the folder',
        message: filePath
      })
    }
  }

  return (
    <div className="app-shell">
      <Header
        activeTab={tab}
        onNavigate={handleNavigate}
        onAbout={() => setModal('about')}
        onTracking={() => setModal('tracking')}
      />

      {tab === 'home' ? (
        <>
          {view === 'home' ? (
            <Home
              value={tagsInput}
              parsed={parsed}
              error={error}
              onChange={(value) => {
                setTagsInput(value)
                if (error) setError(null)
              }}
              onClear={() => {
                setTagsInput('')
                setError(null)
              }}
              onGenerate={() => void handleGenerate()}
              onOpenTracking={() => setModal('tracking')}
            />
          ) : null}

          {view === 'loading' ? (
            <LoadingView
              progress={progress}
              canceling={canceling}
              onCancel={() => void handleCancel()}
            />
          ) : null}

          {view === 'report' && report ? (
            <ReportView
              report={report}
              saving={saving}
              onBack={handleNew}
              onSave={() => void handleSave()}
              onSaveToReports={() => setSaveReportOpen(true)}
              onOpenTracking={() => setModal('tracking')}
              onCopyTag={(tag) => void handleCopyTag(tag)}
            />
          ) : null}
        </>
      ) : null}

      {tab === 'reports' ? (
        libraryReport ? (
          <ReportView
            report={libraryReport.report}
            saving={saving}
            backLabel="Back to reports"
            onBack={() => setLibraryReport(null)}
            onSave={() => void handleExportLibraryReport()}
            saveLabel="Export XLSX"
            onOpenTracking={() => setModal('tracking')}
            onCopyTag={(tag) => void handleCopyTag(tag)}
          />
        ) : (
          <LibraryView
            refreshKey={libraryVersion}
            onOpenReport={handleOpenLibraryReport}
            onOpenRoster={handleOpenRoster}
            onToast={setToast}
          />
        )
      ) : null}

      <RosterMakerView
        active={tab === 'roster'}
        refreshKey={libraryVersion}
        openRequest={rosterRequest}
        onOpenRequestHandled={handleRosterRequestHandled}
        onLibraryChanged={handleLibraryChanged}
        onToast={setToast}
      />

      <footer className="app-footer">
        <span>Developed by Raven Hub</span>
        <span className="footer-separator">·</span>
        <span>{APP_NAME}</span>
        <span className="footer-separator">·</span>
        <span>Data by ClashKing</span>
        <span className="footer-separator">·</span>
        <span>Unofficial, not affiliated with Supercell</span>
        <span className="footer-separator">·</span>
        <button
          type="button"
          className="footer-link"
          onClick={() => void window.raven.openExternal(RAVEN_HUB_DISCORD_URL)}
        >
          <DiscordIcon size={13} />
          Discord
        </button>
        <button
          type="button"
          className="footer-link"
          onClick={() => void window.raven.openExternal(RAVEN_HUB_WEBSITE_URL)}
        >
          <GlobeIcon size={13} />
          Website
        </button>
      </footer>

      {modal === 'about' ? (
        <Modal
          title="About Raven Hub"
          subtitle="A focused CWL report tool for clan leaders."
          onClose={() => setModal(null)}
        >
          <AboutModal appInfo={appInfo} />
        </Modal>
      ) : null}

      {modal === 'tracking' ? (
        <Modal
          title="Tracking a clan"
          subtitle="ClashKing needs a one-time Discord setup before it can store CWL history."
          width="wide"
          onClose={() => setModal(null)}
        >
          <TrackingModal onClose={() => setModal(null)} />
        </Modal>
      ) : null}

      {saveReportOpen && report ? (
        <SaveReportModal
          report={report}
          initialFolderId={settings?.lastReportFolderId ?? null}
          onSave={handleSaveReportToLibrary}
          onClose={() => setSaveReportOpen(false)}
        />
      ) : null}

      {toast ? (
        <Toast
          toast={toast}
          onClose={() => setToast(null)}
          onShowItem={(filePath) => void handleShowItem(filePath)}
        />
      ) : null}
    </div>
  )
}

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  const copied = document.execCommand('copy')
  document.body.removeChild(textarea)

  if (!copied) throw new Error('Clipboard is unavailable')
}
