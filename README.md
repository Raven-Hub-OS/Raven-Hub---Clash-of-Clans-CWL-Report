# Raven Hub CWL Report

A free Windows desktop app that turns Clash of Clans Clan War Leagues history into a clean, shareable Excel report.

Paste one or more clan tags, choose nothing else, and the app finds the latest **finished** CWL season available in ClashKing, aggregates every player's attack and defense performance, previews the result in-app and exports a styled XLSX workbook.

> This material is unofficial and is not endorsed by Supercell. See the [Supercell Fan Content Policy](https://www.supercell.com/fan-content-policy).

## Features

- Accepts up to 20 clan tags at once, with `#` optional.
- Automatically picks the latest ended CWL season across all requested clans.
- Per-player totals and averages: wars participated, attacks, missed attacks, attack stars, average stars, destruction, defenses, defense stars, average defense, reaches and dips.
- Sortable, searchable HTML table preview with clan filtering and a "only missed attacks" filter.
- One polished `Players` sheet in the exported workbook, with conditional formatting, frozen header, autofilter, print settings and a legal/data-source footer.
- Remembers the last submitted clan tags across app restarts.
- Local **Reports** library with nested folders, drag-free move/reorder controls and search.
- **Save to reports** keeps a JSON snapshot of a generated report; XLSX export stays separate.
- **CWL Roster Maker** with one roster table per clan, ordered by league rank, drag-and-drop or add buttons, extra clans loaded by tag, manual players and a single-table XLSX export.
- Reports and rosters share the same folder tree, and you choose the destination folder when saving either one.
- Native save dialogs, then "Show in folder" from the success toast.
- Clear warnings for untracked clans, clans missing the selected season, incomplete wars and suspicious totals.
- No account, no telemetry, no official Supercell API token.
- Finished-season data is cached locally, so repeat reports are fast.

## Requirements

- Windows 10 or 11, 64-bit.
- Internet access to `api.clashk.ing`.
- Clans must be tracked by ClashKing. See [Tracking a clan](#tracking-a-clan-with-clashking).

For development: Node.js 20.19+ or 22.12+ and npm.

## Using the app

1. Paste clan tags, one per line or separated by commas.
2. Click **Generate report**. The submitted tags are remembered for the next launch.
3. Review the preview. Warnings at the top explain any clan that could not be included.
4. Click **Save to reports** to keep the report in the local library, and/or **Save XLSX** to write a workbook anywhere on the computer.

The report always uses the newest CWL season that has **ended** in ClashKing. If the current CWL is still running, the previous season is used.

### Reports and rosters

The **Reports** tab is a local library stored in Electron's `userData` directory. It supports nested folders, search, renaming, moving and reordering. Deleting a folder also deletes the reports and rosters inside it.

To build a lineup, open **Roster Maker**, choose a saved report, and drag any player onto any clan table, even when they played for a different clan in the report. Every clan from the report gets a section, ordered from Legend League down to Bronze League; divisions run I to III with I highest, and Legend League has no division. Players can be moved between clan tables, reordered with the arrow buttons or removed. Each clan table has no player limit.

Use **Add clan** below the sections to load another clan's CWL players for the same season, and **Add player** inside any section for a manual entry. Rosters are saved as snapshots, so a saved roster keeps working even if its source report is later deleted. Saving a roster asks for a name and destination folder in the same library; **Export XLSX** writes one rank-ordered table wherever you choose.

The `#` column in the app and workbook is the player's full player tag (for example `#2YLCCLL0Y`), not a map position.

## Tracking a clan with ClashKing

ClashKing only stores detailed CWL history for clans added to a Discord server with the ClashKing bot. This is a one-time setup per clan:

1. Use or create a Discord server.
2. Invite ClashKing with the required permissions: <https://invite.clashk.ing>.
3. Create a member role and a clan channel.
4. Run `/addclan` and provide the clan tag, category, member role and clan channel.
5. Wait for ClashKing to poll the game, then generate the report again.

Add clans **before** the CWL starts. ClashKing does not guarantee a historical backfill after a clan is added, so tracking usually begins with the next CWL. The app shows the same instructions when it finds an untracked clan, and the **How tracking works** dialog links to the official ClashKing documentation.

## Column definitions

| Column | Meaning |
| --- | --- |
| Clan | Clan name for this row |
| Name | Player name as shown in the most recent war played |
| `#` | Full player tag |
| TH | Town Hall level in the most recent war played |
| Wars Participated | Wars in which the player appeared on the clan lineup |
| Attacks | Attacks used |
| Missed | Missed attacks |
| Attack Stars | Stars earned on attacks |
| Avg Stars | Average attack stars per war |
| Destruction | Total destruction percentage |
| Defenses | Number of defenses |
| Defense Stars | Stars earned on defenses |
| Avg Defense | Average defense stars per war |
| Reaches | Times the player moved up a league |
| Dips | Times the player moved down a league |

## Limitations

- Only CWL is supported; regular clan wars and Clan Capital are out of scope.
- Only the latest ended season is reported. Historical season selection may be added later.
- ClashKing must already track the clan and have data for the selected season.
- `Wars Participated` counts appearances on the lineup, including wars with no attacks used.
- Town Hall is taken from the player's most recent war in the season, which keeps reaches/dips aligned with current upgrades.
- The app requires a network connection; cached data is used when available.

## Legal

- Data provided by **ClashKing** — <https://clashk.ing>. Use of that data is subject to ClashKing's terms.
- This material is unofficial and is not endorsed by Supercell. For more information see Supercell's Fan Content Policy: <https://www.supercell.com/fan-content-policy>.
- Clash of Clans and its logos are trademarks of Supercell.
- The application source code is MIT licensed. See [LICENSE](LICENSE).

## Project structure

```text
src/
  main/                 Electron main process
    clashking/          ClashKing HTTP client, schemas and disk cache
    domain/             Season selection, aggregation, report orchestration
    export/             ExcelJS report and roster workbook generation
    storage/            Atomic JSON file helpers
  preload/              Context-isolated IPC bridge
  renderer/             React UI
  shared/               Shared types, tag parsing, season helpers
build/                  App icons used by Electron and electron-builder
scripts/                Optional live smoke checks
```

## Commands

- `npm install` — Node 20.19+ or 22.12+.
- `npm run dev` — Electron + Vite with hot reload.
- `npm test` — full Vitest suite; fast and network-free by default.
- `npm run typecheck` — both TS projects (`typecheck:node` / `typecheck:web` individually).
- `npm run build` — typecheck, then bundles to `out/`. `npm run start` previews them.
- `npm run check:clashking -- '#TAG' ...` — live ClashKing coverage diagnostic (network).
- `LIVE_CLASHKING=1 LIVE_TAGS='#TAG' npx vitest run src/main/domain/live.test.ts` — opt-in real API end-to-end test (3 min timeout).

`npm run build:win` needs Windows or the Wine Docker command in the README. `build/` holds committed icon assets; build output is `out/` (unpackaged) and `release/` (installers), both gitignored.

### Build the Windows app

On Windows:

```bash
npm run build:win
```

Artifacts are written to `release/`:

- `RavenHub-CWL-Report-<version>-x64.exe` — NSIS installer
- `RavenHub-CWL-Report-<version>-portable.exe` — portable executable

From Linux or macOS, the same command works inside the official Wine-enabled electron-builder image (Docker required):

```bash
docker run --rm \
  -v "$PWD":/project \
  -v "$HOME/.cache/electron":/root/.cache/electron \
  -v "$HOME/.cache/electron-builder":/root/.cache/electron-builder \
  -w /project \
  electronuserland/builder:wine npm run build:win
```

The installers are unsigned because no code-signing certificate is configured. Windows SmartScreen may show a warning on first launch; that is expected for an unsigned community app. A Linux AppImage can be produced with `npm run build:linux`.

### Verify ClashKing coverage

Before sharing the app, check that every clan is tracked and has a finished season:

```bash
npm run check:clashking -- '#TAG' ...
```
