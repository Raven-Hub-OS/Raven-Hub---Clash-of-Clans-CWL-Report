import type { JSX } from 'react'
import type { ReportWarning } from '@shared/types'
import {
  AlertTriangleIcon,
  ChevronDownIcon,
  InfoIcon,
  ShieldIcon
} from './Icons'

interface WarningsPanelProps {
  warnings: ReportWarning[]
  onOpenTracking: () => void
}

export function WarningsPanel({
  warnings,
  onOpenTracking
}: WarningsPanelProps): JSX.Element | null {
  if (warnings.length === 0) return null

  const untracked = warnings.filter((warning) => warning.kind === 'untracked').length

  return (
    <details className="warnings-panel" open={warnings.length <= 2}>
      <summary className="warnings-summary">
        <span className="warnings-title">
          <AlertTriangleIcon size={18} />
          {warnings.length} data notice{warnings.length === 1 ? '' : 's'}
          {untracked > 0 ? (
            <span className="warnings-badge">
              {untracked} untracked clan{untracked === 1 ? '' : 's'}
            </span>
          ) : null}
        </span>
        <span className="warnings-chevron">
          <ChevronDownIcon size={18} />
        </span>
      </summary>

      <div className="warnings-body">
        <ul className="warning-list">
          {warnings.map((warning, index) => {
            const isUntracked = warning.kind === 'untracked'
            return (
              <li className={`warning-item ${isUntracked ? 'warning-strong' : ''}`} key={`${warning.kind}-${index}`}>
                <span className="warning-icon">
                  {isUntracked ? <ShieldIcon size={17} /> : <InfoIcon size={17} />}
                </span>
                <div className="warning-copy">
                  <p className="warning-message">
                    {warning.clanName ? (
                      <strong>
                        {warning.clanName}
                        {warning.clanTag ? ` (${warning.clanTag})` : ''}:{' '}
                      </strong>
                    ) : warning.clanTag ? (
                      <strong>{warning.clanTag}: </strong>
                    ) : null}
                    {warning.message}
                  </p>
                  {warning.detail ? <p className="warning-detail">{warning.detail}</p> : null}
                  {isUntracked ? (
                    <button type="button" className="link-button small" onClick={onOpenTracking}>
                      How to track a clan
                    </button>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </details>
  )
}
