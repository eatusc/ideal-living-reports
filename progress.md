# Progress

Format: `YYYY-MM-DD: change; change; change`

2026-03-26: added `/aceteam` route page (home-style) with `/elevate` link; updated `/aceteam` title to `BE Media Global Reports`; added drag-and-drop support to `UploadBar` (choose + drop).
2026-03-26: verified notes are Supabase-backed (`rpd_notes`); updated all report error states to still render `Campaign Notes` when Excel parse fails.
2026-03-26: added server-provided initial notes to `NotesSection` and passed from all report pages so notes render immediately and independent of client fetch timing/failures.
2026-03-26: fixed notes cache staleness by forcing no-store in `readNotes`, notes API route, and client notes fetch.
2026-03-26: added new `/lustroware` dashboard (2026-only parser + weekly trends + SKU view), wired `/aceteam` link, upload/blob/notes/middleware support, and seeded `data/lustroware/latest.xlsx` from provided file.
2026-03-26: added new `/somarsh` dashboard (30-day search term data), wired `/aceteam` link and report plumbing (upload/blob/notes/middleware), and seeded `data/somarsh/latest.xlsx`.
2026-03-26: enhanced `/somarsh` with inferred peak-cause hover notes on trend spikes and added a 3-day Wins/Watch action panel.
2026-03-26: added `Peak Reason` column in `/somarsh` daily table with hoverable inferred cause details for standout dates.
2026-03-26: added campaign-level analytics to `/somarsh` with strong/review campaign lists and full campaign performance table for actioning terms/campaigns.
2026-03-26: fixed `View Cause` interaction in `/somarsh` with explicit hover/focus tooltip content (not just passive title text).
2026-03-26: increased hover tooltip text sizes (chart tooltips + `/somarsh` `View Cause`) for better readability.
2026-03-26: set SoMarsh-only ACoS target logic to 10% (<=8% good, >=12% bad) for wins/watch and campaign strong/review classification, plus explicit target badge.
2026-03-26: added clickable sort (asc/desc) on all SoMarsh table columns via reusable `SortableTable` client component.
2026-03-26: enabled column sorting across remaining report tables (Lustroware, Elevate, RPD Walmart, RPD HD), including expandable trend/breakdown tables; added default sort options to `SortableTable`.
2026-03-26: fixed SoMarsh `View Cause` tooltip clipping at table edge by anchoring tooltip leftward (`right-0`), raising z-index, and allowing overflow on the daily trend table container.
2026-03-26: added ACE cross-report nav links above each ACE report page (`/elevate`, `/lustroware`, `/somarsh`) to match the inter-report navigation pattern.
2026-03-27: added Google OAuth + private Google Sheets test-read flow (connect/disconnect/status, sheet URL read API, and UploadBar UI preview) while keeping Excel upload path intact.
2026-03-27: added Google OAuth env keys to `.env.local` with localhost callback URI placeholder configuration for local testing.
2026-03-27: improved Google Sheet test-read UX by making `Read Sheet` button high-contrast/bold and expanding read API/preview to process all tabs (batch read) instead of only the first sheet.
2026-03-27: replaced Google test-read with full `Process Sheet` flow per report URL (`/api/google/sheets/process/[company]`): fetch all tabs, run company-specific anomaly checks before save, allow confirm-to-process on anomalies, and added client-side processing progress bar.
2026-03-27: fixed Google-process numeric fidelity by exporting true XLSX from Drive API (instead of stringified values from Sheets batchGet) and added hard-stop critical anomaly blocking (e.g., sales/ad-sales/spend all zero) before any save.
2026-03-27: adjusted critical anomaly detector to parse non-string/rich header cells and wider header scan window to prevent false blocks on valid Lustroware exports.
2026-03-27: expanded ACE navigation to include `Home` and non-ACE report links (`/rpd-walmart`, `/rpd-hd`) in ACE report breadcrumbs and on `/aceteam` directory page.
2026-03-27: added normalized/alias sheet-name resolution (exact + case-insensitive + normalized + fuzzy) to process/anomaly checks and Walmart parser reads, so renamed tabs like `...-By Brand` map to expected report tabs without false missing-sheet errors.
2026-03-27: redesigned `/elevate` UI to match the new light Elevate model (sticky header, white cards/tables, scoped style overrides) while preserving all existing data, links, tabs, and component behavior.
2026-03-27: applied the same Elevate-style light visual scheme across `/rpd-walmart`, `/rpd-hd`, `/lustroware`, and `/somarsh` using shared `report-redesign` scoped styles while keeping all existing data/components/sections unchanged.
2026-03-27: restyled `/` and `/aceteam` to match the new clean light visual system (flat slate background, white bordered cards, consistent link styling).
2026-03-27: added Asana integration on `/elevate` via `ASANA_PAT` + `ASANA_TASK_GID`, including a new in-page tab section (`Dashboard` / `Asana Reports`) that displays one task summary and its comments.
2026-03-27: updated `/elevate` Asana tab to show latest 10 comments in newest-first order and render task attachments with image previews plus file links.
2026-03-27: correlated Asana attachments to the latest 10 comments on `/elevate` (time/author matching) and moved image/file rendering into each comment card to avoid showing unrelated task-wide attachments.
2026-03-27: changed Asana comment image rendering to stacked full-width previews (one per row, 100% container width) for better readability without opening each image.
2026-03-27: changed Asana image click behavior on `/elevate` to open an in-page fullscreen modal preview (no redirect to Asana), with overlay-close + close button.
2026-03-27: updated `/elevate` Asana task env resolution to prefer `ASANA_TASK_GID_ELEVATE` (with fallback to `ASANA_TASK_GID`) for multi-task/multi-page configuration.
