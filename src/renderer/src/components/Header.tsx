import type { JSX } from 'react'
import { RAVEN_HUB_DISCORD_URL, RAVEN_HUB_WEBSITE_URL } from '@shared/app'
import { Logo } from './Logo'
import {
  DiscordIcon,
  FolderIcon,
  GlobeIcon,
  HelpIcon,
  HomeIcon,
  InfoIcon,
  UsersIcon
} from './Icons'

export type PrimaryTab = 'home' | 'reports' | 'roster'

interface HeaderProps {
  activeTab: PrimaryTab
  onNavigate: (tab: PrimaryTab) => void
  onAbout: () => void
  onTracking: () => void
}

export function Header({
  activeTab,
  onNavigate,
  onAbout,
  onTracking
}: HeaderProps): JSX.Element {
  const open = (url: string): void => {
    void window.raven.openExternal(url)
  }

  return (
    <header className="app-header">
      <div className="header-inner">
        <div className="brand">
          <Logo size={40} />
          <div className="brand-copy">
            <span className="brand-name">Raven Hub</span>
            <span className="brand-sub">CWL Report</span>
          </div>
        </div>

        <nav className="primary-nav" aria-label="Primary navigation">
          <button
            type="button"
            className={`primary-tab ${activeTab === 'home' ? 'primary-tab-active' : ''}`}
            onClick={() => onNavigate('home')}
            aria-current={activeTab === 'home' ? 'page' : undefined}
          >
            <HomeIcon size={16} />
            <span>Home</span>
          </button>
          <button
            type="button"
            className={`primary-tab ${activeTab === 'reports' ? 'primary-tab-active' : ''}`}
            onClick={() => onNavigate('reports')}
            aria-current={activeTab === 'reports' ? 'page' : undefined}
          >
            <FolderIcon size={16} />
            <span>Reports</span>
          </button>
          <button
            type="button"
            className={`primary-tab ${activeTab === 'roster' ? 'primary-tab-active' : ''}`}
            onClick={() => onNavigate('roster')}
            aria-current={activeTab === 'roster' ? 'page' : undefined}
          >
            <UsersIcon size={16} />
            <span>Roster Maker</span>
          </button>
        </nav>

        <nav className="header-nav" aria-label="Secondary navigation">
          <button type="button" className="nav-button" onClick={onTracking}>
            <HelpIcon size={17} />
            <span>How tracking works</span>
          </button>
          <button type="button" className="nav-button" onClick={onAbout}>
            <InfoIcon size={17} />
            <span>About</span>
          </button>

          <span className="header-divider" aria-hidden="true" />

          <button
            type="button"
            className="social-button social-button-discord"
            onClick={() => open(RAVEN_HUB_DISCORD_URL)}
            title="Join the Raven Hub Discord"
          >
            <DiscordIcon size={16} />
            <span>Discord</span>
          </button>
          <button
            type="button"
            className="social-button"
            onClick={() => open(RAVEN_HUB_WEBSITE_URL)}
            title="Open ravenhub.store"
          >
            <GlobeIcon size={16} />
            <span>Website</span>
          </button>
        </nav>
      </div>
    </header>
  )
}
