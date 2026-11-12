<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Raven Hub — Organization</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #080c14;
      --surface: #0f172a;
      --surface-light: #172237;
      --surface-hover: #121c2e;
      --primary: #2563eb;
      --primary-hover: #3b82f6;
      --primary-glow: rgba(37, 99, 235, 0.45);
      --primary-dim: rgba(37, 99, 235, 0.10);
      --secondary: #6999ff;
      --accent: #22d3ee;
      --accent-glow: rgba(34, 211, 238, 0.35);
      --text: #f8fafc;
      --text-muted: #cbd5e1;
      --text-subtle: #94a3b8;
      --border: #1e293b;
      --border-glass: rgba(255, 255, 255, 0.06);
      --success: #34d399;
      --warning: #fbbf24;
      --radius-sm: 10px;
      --radius-md: 14px;
      --radius-lg: 20px;
      --radius-xl: 28px;
      --shadow-glow: 0 0 40px var(--primary-glow);
      --shadow-accent: 0 0 40px var(--accent-glow);
      --glass-bg: rgba(8, 12, 20, 0.55);
      --glass-border: rgba(255, 255, 255, 0.08);
      --transition: 0.3s ease;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background: var(--bg);
      color: var(--text);
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      min-height: 100vh;
      overflow-x: hidden;
    }

    a { color: var(--primary-hover); text-decoration: none; }
    a:hover { text-decoration: underline; }

    .container {
      max-width: 1000px;
      margin: 0 auto;
      padding: 0 24px;
    }

    /* Glow background orbs */
    .orb {
      position: fixed;
      border-radius: 50%;
      filter: blur(80px);
      z-index: -1;
      opacity: 0.35;
      animation: float 12s ease-in-out infinite;
    }
    .orb-1 { top: -10%; left: -10%; width: 600px; height: 600px; background: var(--primary); animation-delay: 0s; }
    .orb-2 { bottom: -10%; right: -10%; width: 500px; height: 500px; background: var(--accent); animation-delay: -4s; }
    .orb-3 { top: 20%; right: -5%; width: 400px; height: 400px; background: #6999ff; animation-delay: -8s; }

    @keyframes float {
      0%, 100% { transform: translate(0, 0) scale(1); }
      33% { transform: translate(30px, -50px) scale(1.1); }
      66% { transform: translate(-20px, 40px) scale(0.95); }
    }

    /* Header */
    header {
      padding: 48px 0 20px;
      text-align: center;
      position: relative;
      z-index: 1;
    }

    .logo {
      width: 56px;
      height: 56px;
      border-radius: var(--radius-lg);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, var(--primary), var(--accent));
      box-shadow: 0 0 30px var(--primary-glow);
      margin-bottom: 16px;
      animation: pulse 3s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { box-shadow: 0 0 30px var(--primary-glow); }
      50% { box-shadow: 0 0 50px var(--accent-glow); }
    }

    h1 {
      font-size: clamp(2rem, 5vw, 3.5rem);
      font-weight: 800;
      letter-spacing: -0.04em;
      margin: 0 0 8px;
      background: linear-gradient(135deg, var(--text), var(--primary-hover));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .subtitle {
      font-size: clamp(1rem, 2vw, 1.25rem);
      color: var(--text-muted);
      max-width: 620px;
      margin: 0 auto 8px;
      font-weight: 400;
    }

    .tagline {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.85rem;
      color: var(--accent);
      letter-spacing: 0.15em;
      text-transform: uppercase;
      font-weight: 700;
    }

    /* Badges */
    .badges {
      display: flex;
      justify-content: center;
      gap: 10px;
      margin: 24px 0;
      flex-wrap: wrap;
    }

    .badge {
      padding: 6px 14px;
      border-radius: var(--radius-full);
      border: 1px solid var(--border);
      background: var(--glass-bg);
      backdrop-filter: blur(10px);
      font-size: 0.75rem;
      color: var(--text-muted);
      font-weight: 600;
      transition: all var(--transition);
    }

    .badge:hover {
      border-color: var(--primary);
      color: var(--primary-hover);
      box-shadow: 0 0 20px var(--primary-dim);
    }

    .badge.primary { border-color: var(--primary); color: var(--primary-hover); box-shadow: 0 0 20px var(--primary-dim); }

    /* Divider */
    .divider {
      margin: 60px 0;
      border: none;
      height: 1px;
      background: linear-gradient(90deg, transparent, var(--border), transparent);
    }

    /* Section */
    section { padding: 70px 0; position: relative; z-index: 1; }

    h2 {
      font-size: clamp(1.75rem, 4vw, 2.5rem);
      font-weight: 800;
      text-align: center;
      margin-bottom: 16px;
      letter-spacing: -0.02em;
    }

    .section-desc {
      text-align: center;
      color: var(--text-muted);
      max-width: 650px;
      margin: 0 auto 48px;
      font-size: 1.05rem;
    }

    /* Cards grid */
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 24px;
    }

    .card {
      background: var(--glass-bg);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-lg);
      padding: 32px 28px;
      backdrop-filter: blur(16px);
      transition: all var(--transition);
      position: relative;
      overflow: hidden;
    }

    .card::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 2px;
      background: linear-gradient(90deg, transparent, var(--primary), transparent);
      opacity: 0;
      transition: opacity var(--transition);
    }

    .card:hover {
      border-color: var(--border-glass);
      transform: translateY(-6px);
      box-shadow: 0 20px 48px rgba(0,0,0,0.35);
    }

    .card:hover::before { opacity: 1; }

    .card h3 {
      font-size: 1.25rem;
      font-weight: 700;
      margin-bottom: 10px;
      color: var(--text);
    }

    .card p {
      color: var(--text-muted);
      font-size: 0.95rem;
      margin-bottom: 18px;
      line-height: 1.7;
    }

    .card .tech {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 14px;
    }

    .tech span {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.72rem;
      padding: 4px 10px;
      border-radius: var(--radius-sm);
      background: var(--surface);
      border: 1px solid var(--border);
      color: var(--text-subtle);
    }

    .card .link {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-top: 16px;
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--primary-hover);
    }

    .card .link:hover { color: var(--accent); text-decoration: none; }

    /* CTA */
    .cta {
      text-align: center;
      padding: 80px 24px;
      background: linear-gradient(120deg, var(--primary-dim) 0%, var(--surface) 50%, var(--primary-dim) 100%);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-xl);
      margin-top: 20px;
    }

    .cta h2 {
      color: var(--text);
      margin-bottom: 12px;
    }

    .cta p {
      color: var(--text-muted);
      margin-bottom: 30px;
      font-size: 1.05rem;
      max-width: 600px;
      margin-left: auto;
      margin-right: auto;
    }

    .btn-group { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; }

    .btn {
      padding: 14px 32px;
      border-radius: var(--radius-lg);
      font-weight: 700;
      font-size: 0.95rem;
      transition: all var(--transition);
      display: inline-flex;
      align-items: center;
      gap: 8px;
      border: none;
      cursor: pointer;
    }

    .btn-primary {
      background: linear-gradient(135deg, var(--primary), var(--secondary));
      color: #fff;
      box-shadow: 0 0 30px var(--primary-glow);
    }

    .btn-primary:hover {
      transform: translateY(-3px);
      box-shadow: 0 12px 40px var(--primary-glow);
      filter: brightness(1.1);
    }

    .btn-ghost {
      background: var(--surface);
      color: var(--text);
      border: 1px solid var(--border);
    }

    .btn-ghost:hover {
      border-color: var(--primary);
      color: var(--primary-hover);
    }

    /* Stats */
    .stats {
      display: flex;
      justify-content: center;
      gap: 32px;
      flex-wrap: wrap;
      margin-top: 10px;
      padding-top: 30px;
      border-top: 1px solid var(--glass-border);
    }

    .stat {
      text-align: center;
    }

    .stat strong {
      font-size: 1.6rem;
      font-weight: 800;
      color: var(--text);
      display: block;
      letter-spacing: -0.02em;
      background: linear-gradient(135deg, var(--primary-hover), var(--accent));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .stat span {
      font-size: 0.8rem;
      color: var(--text-subtle);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      font-weight: 600;
    }

    /* Footer */
    footer {
      padding: 50px 0 30px;
      text-align: center;
      border-top: 1px solid var(--border);
      color: var(--text-subtle);
      font-size: 0.85rem;
    }

    .footer-links {
      display: flex;
      justify-content: center;
      gap: 24px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }

    .footer-links a {
      color: var(--text-subtle);
      font-size: 0.85rem;
      transition: color 0.2s;
    }

    .footer-links a:hover { color: var(--primary-hover); text-decoration: none; }

    .legal {
      font-size: 0.75rem;
      color: var(--text-subtle);
      margin-top: 10px;
    }

    /* Responsive */
    @media (max-width: 640px) {
      .btn-group { flex-direction: column; align-items: center; }
      .card { padding: 26px 22px; }
    }
  </style>
</head>
<body>

  <!-- Ambient orbs -->
  <div class="orb orb-1"></div>
  <div class="orb orb-2"></div>
  <div class="orb orb-3"></div>

  <div class="container">
    <header>
      <div class="logo" aria-label="Raven Hub logo">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 0 8px rgba(255,255,255,0.6));">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/>
          <path d="M2 17l10 -5 10 5"/>
          <circle cx="12" cy="12" r="4" stroke="#22d3ee" stroke-width="2"/>
        </svg>
      </div>
      <h1>Raven Hub</h1>
      <p class="subtitle">Custom Discord bots, hosting, and community tooling — built for clan leaders, server owners, and developers who want power without complexity.</p>
      <div class="tagline">Open Source · Built in the Open · Discord Native</div>
      <div class="badges">
        <span class="badge primary">Electron · React · TypeScript</span>
        <span class="badge">Discord.js · Node.js</span>
        <span class="badge">ClashKing API</span>
        <span class="badge">MIT License</span>
        <span class="badge">Windows Ready</span>
        <span class="badge">No Telemetry</span>
      </div>
    </header>

    <hr class="divider" />

    <section>
      <h2>What we build</h2>
      <p class="section-desc">Open-source tools and services for Discord communities — from moderation and economy to Clash of Clans CWL reporting and custom bot development.</p>
      <div class="grid">
        <article class="card">
          <h3>🪶 Raven Hub — CWL Report</h3>
          <p>A free Windows desktop app that turns Clash of Clans Clan War Leagues history into a clean, shareable Excel report. Paste clan tags, generate the latest finished season, preview per-player stats, and export styled XLSX workbooks.</p>
          <div class="tech">
            <span>Electron</span>
            <span>React 19</span>
            <span>TypeScript</span>
            <span>ExcelJS</span>
          </div>
          <a href="https://github.com/Raven-Hub-OS/Raven-Hub---Clash-of-Clans-CWL-Report" class="link" target="_blank">View repository →</a>
        </article>

        <article class="card">
          <h3>🤖 Raven Bot</h3>
          <p>A modular Discord bot with ticket systems, giveaways, moderation, economy, social notifications, and database-backed server settings. Built with discord.js and ready to deploy.</p>
          <div class="tech">
            <span>discord.js v14</span>
            <span>Node.js</span>
            <span>PostgreSQL</span>
            <span>Docker</span>
          </div>
          <a href="https://github.com/Raven-Hub-OS/raven-bot" class="link" target="_blank">View repository →</a>
        </article>

        <article class="card">
          <h3>🌐 Raven Hub Website</h3>
          <p>The official storefront and documentation hub. Custom Discord bot packs, hosting, and community services — all in one place.</p>
          <div class="tech">
            <span>HTML5</span>
            <span>CSS3</span>
            <span>JavaScript</span>
            <span>Netlify</span>
          </div>
          <a href="https://ravenhub.store" class="link" target="_blank">Visit website →</a>
        </article>
      </div>
    </section>

    <hr class="divider" />

    <section>
      <h2>Why Raven Hub?</h2>
      <p class="section-desc">Running a community shouldn't mean juggling a dozen tools. We bring useful features together under one roof.</p>
      <div class="stats">
        <div class="stat">
          <strong>0€</strong>
          <span>Free core tools</span>
        </div>
        <div class="stat">
          <strong>∞</strong>
          <span>Servers supported</span>
        </div>
        <div class="stat">
          <strong>0</strong>
          <span>Telemetry / tracking</span>
        </div>
      </div>
    </section>

    <div class="cta">
      <h2>Join the community</h2>
      <p>Get support, suggest features, and stay updated on new releases.</p>
      <div class="btn-group">
        <a href="https://discord.gg/CjHv7Jpk5d" class="btn btn-primary" target="_blank">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#ffffff"><path d="M12 2.163c3.204 0 5.806 2.494 5.806 5.806 0 2.603-1.671 4.791-3.928 5.535v-3.584H9.43v3.584c-2.257-.744-3.836-2.932-3.836-5.535 0-3.313 2.602-5.806 5.806-5.806m0 10.411c-2.545 0-4.613-2.068-4.613-4.613 0-2.546 2.068-4.613 4.613-4.613 2.545 0 4.613 2.067 4.613 4.613 0 2.545-2.068 4.613-4.613 4.613z"/></svg>
          Discord Server
        </a>
        <a href="https://ravenhub.store" class="btn btn-ghost" target="_blank">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
          ravenhub.store
        </a>
      </div>
    </div>

    <hr class="divider" />

    <footer>
      <div class="footer-links">
        <a href="https://ravenhub.store" target="_blank">Website</a>
        <a href="https://discord.gg/CjHv7Jpk5d" target="_blank">Discord</a>
        <a href="https://github.com/Raven-Hub-OS" target="_blank">Organization</a>
      </div>
      <div class="legal">
        Raven Hub &copy; 2026. Open source under the MIT License.<br>
        This material is unofficial and is not endorsed by Supercell. Data provided by ClashKing (clashk.ing).
      </div>
    </footer>
  </div>

</body>
</html>
