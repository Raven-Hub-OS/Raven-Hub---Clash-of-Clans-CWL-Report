import type { JSX } from 'react'
import type { ParsedTags } from '@shared/tags'
import { MAX_TAGS } from '@shared/tags'
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  CheckIcon,
  ClockIcon,
  ExternalLinkIcon,
  FileSpreadsheetIcon,
  ShieldIcon,
  SparklesIcon,
  SwordsIcon,
  TargetIcon,
  UsersIcon
} from './Icons'

interface HomeProps {
  value: string
  parsed: ParsedTags
  error: string | null
  onChange: (value: string) => void
  onClear: () => void
  onGenerate: () => void
  onOpenTracking: () => void
}

export function Home({
  value,
  parsed,
  error,
  onChange,
  onClear,
  onGenerate,
  onOpenTracking
}: HomeProps): JSX.Element {
  const tooMany = parsed.tags.length > MAX_TAGS
  const canGenerate = parsed.tags.length > 0 && !tooMany

  return (
    <main className="main home-main">
      <section className="hero-grid">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="eyebrow-dot" />
            Clan War Leagues · Player report
          </div>

          <h1>
            Every CWL attack.
            <br />
            <span className="text-gradient">One clean report.</span>
          </h1>

          <p className="hero-lede">
            Paste your clan tags. Raven Hub pulls the latest finished CWL season from ClashKing,
            aggregates every player and builds a workbook your leaders can actually use.
          </p>

          <div className="panel input-panel">
            <div className="panel-head">
              <label htmlFor="clan-tags">Clan tags</label>
              <span className="muted">Up to {MAX_TAGS} clans</span>
            </div>

            <textarea
              id="clan-tags"
              className="tag-input"
              value={value}
              onChange={(event) => onChange(event.target.value)}
              placeholder={'#2YLCCLL0Y\n#GCQL0029\n#U290P80P'}
              spellCheck={false}
              autoComplete="off"
              rows={6}
              aria-describedby="tag-help"
            />

            <p id="tag-help" className="field-hint">
              One per line or separated by commas. Tags can be pasted with or without the #.
            </p>

            {parsed.tags.length > 0 ? (
              <div className="tag-preview" aria-label="Detected clan tags">
                {parsed.tags.map((tag) => (
                  <span className="tag-chip" key={tag}>
                    <span className="tag-chip-dot" />
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}

            {parsed.invalid.length > 0 ? (
              <div className="invalid-tags" role="alert">
                <AlertTriangleIcon size={16} />
                <span>
                  Not a valid tag: {parsed.invalid.slice(0, 6).join(', ')}
                  {parsed.invalid.length > 6 ? ` and ${parsed.invalid.length - 6} more` : ''}
                </span>
              </div>
            ) : null}

            {parsed.duplicateCount > 0 ? (
              <p className="field-hint">
                {parsed.duplicateCount} duplicate
                {parsed.duplicateCount === 1 ? '' : 's'} ignored.
              </p>
            ) : null}

            {tooMany ? (
              <div className="invalid-tags" role="alert">
                <AlertTriangleIcon size={16} />
                <span>
                  Remove {parsed.tags.length - MAX_TAGS} tag
                  {parsed.tags.length - MAX_TAGS === 1 ? '' : 's'} to stay within the limit.
                </span>
              </div>
            ) : null}

            {error ? (
              <div className="inline-error" role="alert">
                <AlertTriangleIcon size={17} />
                <span>{error}</span>
              </div>
            ) : null}

            <div className="input-actions">
              <button
                type="button"
                className="button button-primary"
                onClick={onGenerate}
                disabled={!canGenerate}
              >
                Generate report
                <ArrowRightIcon size={17} />
              </button>
              <button
                type="button"
                className="button button-ghost"
                onClick={onClear}
                disabled={!value}
              >
                Clear
              </button>
              <span className="input-count">
                {parsed.tags.length === 0
                  ? 'No clans yet'
                  : `${parsed.tags.length} clan${parsed.tags.length === 1 ? '' : 's'} ready`}
              </span>
            </div>
          </div>

          <div className="trust-row">
            <span>
              <CheckIcon size={14} /> No account
            </span>
            <span>
              <CheckIcon size={14} /> No API token
            </span>
            <span>
              <CheckIcon size={14} /> Data cached locally
            </span>
          </div>
        </div>

        <aside className="hero-side">
          <div className="panel side-panel">
            <div className="side-panel-title">
              <SparklesIcon size={17} />
              Inside the report
            </div>
            <ul className="feature-list">
              <li>
                <span className="feature-icon">
                  <SwordsIcon size={17} />
                </span>
                <span>
                  <strong>Attack output</strong>
                  <small>Stars, averages and destruction</small>
                </span>
              </li>
              <li>
                <span className="feature-icon">
                  <ClockIcon size={17} />
                </span>
                <span>
                  <strong>Missed attacks</strong>
                  <small>Spot inactivity at a glance</small>
                </span>
              </li>
              <li>
                <span className="feature-icon">
                  <ShieldIcon size={17} />
                </span>
                <span>
                  <strong>Defense record</strong>
                  <small>Defenses and stars conceded</small>
                </span>
              </li>
              <li>
                <span className="feature-icon">
                  <TargetIcon size={17} />
                </span>
                <span>
                  <strong>Reaches and dips</strong>
                  <small>Who punched up or down a TH</small>
                </span>
              </li>
              <li>
                <span className="feature-icon">
                  <UsersIcon size={17} />
                </span>
                <span>
                  <strong>Every player</strong>
                  <small>Name, tag, TH and wars played</small>
                </span>
              </li>
              <li>
                <span className="feature-icon">
                  <FileSpreadsheetIcon size={17} />
                </span>
                <span>
                  <strong>One shareable sheet</strong>
                  <small>Styled XLSX, ready to send</small>
                </span>
              </li>
            </ul>
          </div>

          <div className="panel source-panel">
            <div className="source-title">
              <ShieldIcon size={18} />
              Data by ClashKing
            </div>
            <p>
              ClashKing collects and provides the CWL history. Raven Hub never talks to Supercell
              directly and does not need an official API token.
            </p>
            <div className="source-actions">
              <button type="button" className="link-button" onClick={onOpenTracking}>
                How tracking works
                <ArrowRightIcon size={15} />
              </button>
              <button
                type="button"
                className="link-button subtle"
                onClick={() => void window.raven.openExternal('https://clashk.ing')}
              >
                clashk.ing
                <ExternalLinkIcon size={14} />
              </button>
            </div>
          </div>

          <p className="legal-note">
            Unofficial. Not affiliated with or endorsed by Supercell. See the Supercell Fan Content
            Policy.
          </p>
        </aside>
      </section>
    </main>
  )
}
