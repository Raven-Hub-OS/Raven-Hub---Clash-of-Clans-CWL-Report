import { useCallback, useEffect, useState, type JSX } from 'react'
import type { ToastData } from './Toast'
import { DownloadIcon, XIcon } from './Icons'

interface UpdateNotifierProps {
  onToast: (toast: ToastData) => void
}

export function UpdateNotifier({ onToast }: UpdateNotifierProps): JSX.Element | null {
  const [updateInfo, setUpdateInfo] = useState<unknown>(null)
  const [downloaded, setDownloaded] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)

  const handleAvailable = useCallback(
    (info: unknown) => {
      setUpdateInfo(info)
    },
    []
  )

  const handleDownloaded = useCallback(
    (info: unknown) => {
      setUpdateInfo(info)
      setDownloaded(true)
      onToast({
        kind: 'success',
        title: 'Update downloaded',
        message: 'The new version has been downloaded. Click to restart and install.'
      })
    },
    [onToast]
  )

  const handleProgress = useCallback((p: unknown) => {
    const value = typeof p === 'object' && p !== null && 'percent' in p ? (p as { percent: number }).percent : null
    setProgress(value)
  }, [])

  const handleError = useCallback((message: string) => {
    onToast({
      kind: 'error',
      title: 'Error checking for updates',
      message
    })
  }, [onToast])

  const handleInstall = useCallback(async () => {
    if (typeof window.raven?.installUpdate === 'function') {
      await window.raven.installUpdate()
    }
  }, [])

  const dismiss = useCallback(() => {
    setUpdateInfo(null)
    setDownloaded(false)
    setProgress(null)
  }, [])

  useEffect(() => {
    const unsubs: (() => void)[] = []

    if (typeof window.raven?.onUpdateAvailable === 'function') {
      unsubs.push(window.raven.onUpdateAvailable(handleAvailable))
    }
    if (typeof window.raven?.onUpdateDownloaded === 'function') {
      unsubs.push(window.raven.onUpdateDownloaded(handleDownloaded))
    }
    if (typeof window.raven?.onUpdateDownloadProgress === 'function') {
      unsubs.push(window.raven.onUpdateDownloadProgress(handleProgress))
    }
    if (typeof window.raven?.onUpdateError === 'function') {
      unsubs.push(window.raven.onUpdateError(handleError))
    }

    return () => {
      unsubs.forEach((unsub) => unsub())
    }
  }, [handleAvailable, handleDownloaded, handleProgress, handleError])

  if (!updateInfo && !downloaded) return null

  return (
    <div
      className={`toast toast-${downloaded ? 'success' : 'info'}`}
      role="status"
    >
      <div className="toast-icon" aria-hidden="true">
        <DownloadIcon size={21} />
      </div>
      <div className="toast-content">
        <p className="toast-title">
          {downloaded ? 'Update ready' : 'New version available'}
        </p>
        {progress !== null ? (
          <p className="toast-message">Downloading: {progress.toFixed(0)}%</p>
        ) : null}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {!downloaded ? (
          <button
            type="button"
            className="button button-secondary"
            onClick={() => {
              onToast({
                kind: 'success',
                title: 'Update started',
                message: 'The new version will be downloaded in the background.'
              })
              void window.raven?.installUpdate?.()
            }}
          >
            <DownloadIcon size={14} />
            Update now
          </button>
        ) : (
          <button
            type="button"
            className="button button-primary"
            onClick={handleInstall}
          >
            <DownloadIcon size={14} />
            Restart and update
          </button>
        )}
        <button type="button" className="icon-button toast-close" onClick={dismiss} aria-label="Dismiss">
          <XIcon size={16} />
        </button>
      </div>
    </div>
  )
}
