import type { JSX } from 'react'
import type { ProgressEvent } from '@shared/types'
import { Logo } from './Logo'
import { XIcon } from './Icons'

interface LoadingViewProps {
  progress: ProgressEvent | null
  canceling: boolean
  onCancel: () => void
}

const STEPS = ['Check clans', 'Load wars', 'Build report'] as const

export function LoadingView({
  progress,
  canceling,
  onCancel
}: LoadingViewProps): JSX.Element {
  const activeStep =
    progress?.phase === 'seasons' ? 0 : progress?.phase === 'groups' ? 1 : 2
  const percent = progressPercent(progress)

  return (
    <main className="main loading-main">
      <section className="loading-card panel">
        <div className="loading-mark">
          <span className="loading-ring" />
          <Logo size={58} />
        </div>

        <p className="eyebrow centered">Working on it</p>
        <h1>Building your report</h1>
        <p className="loading-message">{progress?.message ?? 'Starting the request…'}</p>

        <div
          className="progress-track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(percent)}
          aria-label="Report generation progress"
        >
          <span className="progress-fill" style={{ width: `${percent}%` }} />
        </div>

        <div className="loading-meta">
          <span>{Math.round(percent)}%</span>
          <span>
            {progress && progress.total > 0
              ? `${Math.min(progress.current, progress.total)} of ${progress.total} steps`
              : 'Preparing'}
          </span>
        </div>

        <ol className="loading-steps">
          {STEPS.map((step, index) => (
            <li
              key={step}
              className={
                index < activeStep
                  ? 'step-done'
                  : index === activeStep
                    ? 'step-active'
                    : 'step-todo'
              }
            >
              <span className="step-index">{index + 1}</span>
              {step}
            </li>
          ))}
        </ol>

        <p className="loading-tip">
          The first run for a season can take a few seconds per clan. Finished seasons are cached
          locally, so the next report is much faster.
        </p>

        <button
          type="button"
          className="button button-ghost cancel-button"
          onClick={onCancel}
          disabled={canceling}
        >
          <XIcon size={16} />
          {canceling ? 'Cancelling…' : 'Cancel'}
        </button>
      </section>
    </main>
  )
}

function progressPercent(progress: ProgressEvent | null): number {
  if (!progress) return 6

  if (progress.phase === 'done') return 100
  if (progress.phase === 'aggregate') return 92

  const ratio =
    progress.total > 0 ? Math.min(1, Math.max(0, progress.current / progress.total)) : 0

  if (progress.phase === 'seasons') return 8 + ratio * 32
  if (progress.phase === 'groups') return 44 + ratio * 44
  return 6
}
