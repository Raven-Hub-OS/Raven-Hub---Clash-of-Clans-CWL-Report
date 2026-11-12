import type { JSX } from 'react'
import { APP_NAME, RAVEN_HUB_DISCORD_URL, RAVEN_HUB_WEBSITE_URL } from '@shared/app'
import type { AppInfo } from '@shared/types'
import { Logo } from './Logo'
import {
  DatabaseIcon,
  DiscordIcon,
  ExternalLinkIcon,
  FolderIcon,
  GlobeIcon,
  ShieldIcon
} from './Icons'

interface AboutModalProps {
  appInfo: AppInfo | null
}

export function AboutModal({ appInfo }: AboutModalProps): JSX.Element {
  const open = (url: string): void => {
    void window.raven.openExternal(url)
  }

  return (
    <div className="about-content">
      <div className="about-brand">
        <Logo size={58} />
        <div>
          <h3>{APP_NAME}</h3>
          <p>
            Version {appInfo?.version ?? '0.1.0'} · {platformLabel(appInfo?.platform)}
          </p>
        </div>
      </div>

      <p className="about-lede">
        A small desktop tool for clan leaders who would rather analyse CWL performance than
        copy-paste it out of a dozen screens.
      </p>

      <section className="about-section">
        <h4>
          <GlobeIcon size={17} />
          Raven Hub community
        </h4>
        <p>
          We're building a better way to manage Discord communities, bringing the tools you need together in one place. 
          Follow Raven Hub for updates, support and new tools. Join the Discord to talk with the
          community or visit the website to see everything we build.
        </p>
        <div className="about-actions">
          <button
            type="button"
            className="button button-primary"
            onClick={() => open(RAVEN_HUB_DISCORD_URL)}
          >
            <DiscordIcon size={16} />
            Join Discord
          </button>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => open(RAVEN_HUB_WEBSITE_URL)}
          >
            <GlobeIcon size={16} />
            ravenhub.store
          </button>
        </div>
      </section>

      <section className="about-section">
        <h4>
          <DatabaseIcon size={17} />
          Data source
        </h4>
        <p>
          Clan and CWL history is collected and provided by{' '}
          <strong>ClashKing</strong>. Raven Hub requests that data directly from{' '}
          <code>api.clashk.ing</code> and does not present it as independently collected data.
        </p>
        <button type="button" className="link-button small" onClick={() => open('https://clashk.ing')}>
          Visit clashk.ing
          <ExternalLinkIcon size={14} />
        </button>
      </section>

      <section className="about-section">
        <h4>
          <ShieldIcon size={17} />
          Legal
        </h4>
        <p>
          This material is unofficial and is not endorsed by Supercell. For more information see
          Supercell&apos;s Fan Content Policy. Clash of Clans and its logos are trademarks of
          Supercell.
        </p>
        <button
          type="button"
          className="link-button small"
          onClick={() => open('https://www.supercell.com/fan-content-policy')}
        >
          Supercell Fan Content Policy
          <ExternalLinkIcon size={14} />
        </button>
      </section>

      <section className="about-section">
        <h4>
          <FolderIcon size={17} />
          Privacy and local data
        </h4>
        <p>
          No account, no telemetry and no official Supercell API token. ClashKing responses are
          cached on this computer so repeated reports are faster. Saved reports, rosters and
          folders stay in the local report library.
        </p>
        {appInfo?.cachePath ? (
          <div className="about-path">
            <span className="about-path-label">ClashKing cache</span>
            <code className="cache-path" title={appInfo.cachePath}>
              {appInfo.cachePath}
            </code>
          </div>
        ) : null}
        {appInfo?.libraryPath ? (
          <div className="about-path">
            <span className="about-path-label">Report library</span>
            <code className="cache-path" title={appInfo.libraryPath}>
              {appInfo.libraryPath}
            </code>
          </div>
        ) : null}
      </section>

      <p className="about-footer">
        Built with Electron, React and ExcelJS. The application code is MIT licensed. ClashKing
        data remains subject to ClashKing&apos;s terms.
      </p>
    </div>
  )
}

function platformLabel(platform: string | undefined): string {
  if (platform === 'win32') return 'Windows'
  if (platform === 'darwin') return 'macOS'
  if (platform === 'linux') return 'Linux'
  return 'Desktop'
}
