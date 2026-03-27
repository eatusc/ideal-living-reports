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
