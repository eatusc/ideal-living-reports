# CLAUDE.md — Ideal Living Dashboard

## Project Overview

A local Next.js multi-client reporting dashboard. Three weekly performance reports, each at a PIN-protected URL:

- `/rpd-walmart` — Ideal Living: Walmart Advertising & Sales (PPC + SEM)
- `/elevate` — Elevate Beverages: Amazon + Walmart + SEM (multi-platform)
- `/rpd-hd` — RPD Home Depot: Orange Access advertising

Access is PIN-gated via middleware + a cookie (PIN in `app/api/auth/route.ts`).
This app runs **locally only** (`npm run dev`). File uploads write to the local filesystem.

## Tech Stack

- Next.js 14 App Router (SSR — no static export)
- React 18, TypeScript strict mode
- Tailwind CSS 3 (custom colors defined in `tailwind.config.ts` and `globals.css`)
- `xlsx` npm package for server-side Excel parsing
- No database — all data stored as Excel files + JSON in `data/`

## Run Locally

```bash
npm run dev   # http://localhost:3000
```

## Vercel Deployment

This app uses Next.js SSR (no static export). Vercel project settings must be configured correctly or deploys will fail.

**Required Vercel project settings** (Settings → Build & Output Settings):
- **Framework Preset**: Next.js
- **Output Directory**: ← leave blank (do not set)
- `vercel.json` should stay as `{}` — do not add `outputDirectory`

**If you see "No Output Directory found" errors**: the Vercel dashboard has a stale Output Directory override. Clear it in project settings and redeploy. This typically happens after switching from static export (`output: 'export'`) to SSR.

## Key Files

| File | Purpose |
|------|---------|
| `middleware.ts` | PIN cookie check — redirects unauthed requests to `/pin` |
| `app/api/auth/route.ts` | POST: validates PIN, sets `pin_auth` cookie |
| `app/api/upload/[company]/route.ts` | POST: saves uploaded Excel to `data/[company]/latest.xlsx` + dated backup |
| `app/api/notes/[company]/route.ts` | GET + POST: reads/writes `data/notes/[company].json` |
| `lib/parseExcel.ts` | RPD Walmart Excel parser + shared utilities (`safeNum`, `safeRate`, `fmtDollar`, `fmtPct`, `fmtRoas`, `wowPct`, `acosClass`) |
| `lib/parseElevate.ts` | Elevate Beverages parser (Amazon + Walmart + SEM sheets) |
| `lib/parseRpdHd.ts` | RPD Home Depot parser (Orange Access sheet) |
| `lib/notes.ts` | Notes JSON read/write helpers |
| `components/UploadBar.tsx` | File upload button + status display (client component) |
| `components/NotesSection.tsx` | Notes list + add-note form (client component) |

## Data Folder Structure

```
data/
├── rpd/
│   ├── latest.xlsx        ← active data file (read by report)
│   └── YYYY-MM-DD.xlsx    ← dated backups (created on each upload)
├── elevate/
│   ├── latest.xlsx
│   └── YYYY-MM-DD.xlsx
├── rpd-hd/
│   ├── latest.xlsx
│   └── YYYY-MM-DD.xlsx
└── notes/
    ├── rpd-walmart.json   ← [{date, action, doneBy}]
    ├── elevate.json
    └── rpd-hd.json
```

## Data Update Workflow

1. Export the latest Excel file from the relevant platform (Intentwise / Walmart Seller Center / Amazon / Home Depot Orange Access)
2. Go to the report page and click **Upload**
3. Select the `.xlsx` file → click **Upload** → file saved as `latest.xlsx`
4. Click **Reload Report** to refresh with new data

## Excel Sheet Name Requirements

| Report | Required Sheet(s) |
|--------|------------------|
| RPD Walmart | `WALMART_weekly_reporting_2026-B` · `SEM Campaigns Data 2026` |
| Elevate | `2026 - Amazon Performance Repor` · `2026 - Walmart Performance Repo` · `2026 SEM Campaigns Data - per d` |
| RPD-HD | `ALL - 2026 - Orange Access` |

Data layout: headers at row 10 (0-indexed), data from row 11 onward. Week summary rows detected by `col[1].toLowerCase().includes('week')`.

## User Preferences

- **Apply changes across all reports by default.** When a UI or data change is requested for one report (`/rpd-walmart`, `/elevate`, `/rpd-hd`), apply it to all three unless the request is clearly specific to one client. If it's ambiguous whether a change makes sense for the other reports, ask first before applying.

## Coding Conventions

- **Functional components only** — no class components
- **Server components** for data fetching (report pages); **client components** (`'use client'`) for interactivity (UploadBar, NotesSection, PinPage)
- **Tailwind for all styling** — no inline `style` objects except `topColor` on ScoreCard (which needs dynamic hex values)
- **Shared utilities** live in `lib/parseExcel.ts` — import `safeNum`, `safeRate`, `fmtDollar`, `fmtPct`, `fmtRoas`, `wowPct`, `acosClass` from there in new parsers
- **Error handling**: each report page wraps the parse call in try/catch and renders an amber "No data file found" state with the UploadBar visible so users can upload a file

## Color Palette

| Variable | Value | Used for |
|----------|-------|---------|
| `#0A0F1C` | Dark navy | Page background |
| `#111827` | `bg-dash-card` | Card background |
| `#1A2235` | `bg-dash-card2` | Table header background |
| `#FFC220` | Walmart yellow | Section titles, RPD Walmart accent |
| `#0071CE` | Walmart blue | RPD Walmart highlights |
| `#FF9900` | Amazon orange | Elevate Amazon accent |
| `#F96302` | HD orange | RPD Home Depot accent |
| `#E8EDF5` | Light blue-gray | Primary text |

## Adding a New Report

1. Create a data folder under `data/[company-slug]/`
2. Add a parser in `lib/parse[Company].ts` (follow `parseRpdHd.ts` as a template)
3. Add the company slug to `COMPANY_DIRS` in `app/api/upload/[company]/route.ts`
4. Add the company slug to `isValidCompany()` in `lib/notes.ts`
5. Add the route to `PROTECTED_PREFIXES` in `middleware.ts`
6. Create `app/[company-slug]/page.tsx` (follow `app/rpd-hd/page.tsx` as a template)
7. Add `UploadBar company="[company-slug]"` and `NotesSection company="[company-slug]"` to the page
8. Update `app/page.tsx` to list the new report URL
