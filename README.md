# Ideal Living — Multi-Client Reporting Dashboard

A local Next.js dashboard for weekly advertising and sales performance reports across three clients. Each report reads from an Excel file, supports in-browser file uploads, and includes a campaign notes system.

## Reports

| URL | Client | Data Source |
|-----|--------|------------|
| `/rpd-walmart` | Ideal Living — Walmart Ads | `data/rpd/latest.xlsx` |
| `/elevate` | Elevate Beverages — Amazon + Walmart + SEM | `data/elevate/latest.xlsx` |
| `/rpd-hd` | RPD Home Depot — Orange Access | `data/rpd-hd/latest.xlsx` |
| `/brand-ops` | Cross-brand action + risk board | Aggregates all report parsers |

All reports are PIN-protected (see Authentication below).

## Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Navigate to a report URL to begin.

## Supabase Project Binding

This project directory is bound to Supabase project ref `gwdbvwghamrwcfqksmhw`.

- Expected URL: `https://gwdbvwghamrwcfqksmhw.supabase.co`
- `lib/supabase.ts` enforces this ref and will throw if `NEXT_PUBLIC_SUPABASE_URL` points to another project.
- `.mcp.json` should also use `--project-ref gwdbvwghamrwcfqksmhw`.

If MCP reports a different project URL, reconnect/restart MCP before applying SQL migrations.

## Authentication

All report pages require a 4-digit PIN. After entry, a 30-day cookie is set so you only need to enter it once.

The PIN is configured in `app/api/auth/route.ts`.

## Updating Data

Each report page has an **Upload** button at the top:

1. Click "Choose Excel file…" and select your updated `.xlsx`
2. Click **Upload** — the file is saved as `data/[company]/latest.xlsx` and a dated backup (`YYYY-MM-DD.xlsx`) is also kept
3. Click **Reload Report** to refresh the page with the new data

No rebuild or deployment needed — the app reads the file on every page load.

## Campaign Notes

Each report has a **Campaign Notes** section at the bottom. Notes are stored as JSON in `data/notes/[company].json`.

To add a note:
1. Click **+ Add Note**
2. Fill in the date, action taken, and your name
3. Click **Save Note**

## Excel Sheet Requirements

Each file must contain these sheet names (exact match required):

| Report | Required Sheet |
|--------|---------------|
| RPD Walmart | `WALMART_weekly_reporting_2026-B`, `SEM Campaigns Data 2026` |
| Elevate | `2026 - Amazon Performance Repor`, `2026 - Walmart Performance Repo`, `2026 SEM Campaigns Data - per d` |
| RPD-HD | `ALL - 2026 - Orange Access` |

Data must start at row 12 (0-indexed row 11), with column headers at row 11 (0-indexed row 10).

For RPD Walmart: the sheet must contain rows explicitly labeled `Current Week` and `Previous Week` in column B.

For Elevate and RPD-HD: the most recent two week summary rows (any row with "Week" in column B) are used as current and previous.

## Project Structure

```
app/
├── page.tsx              # Home (public, no PIN needed)
├── pin/page.tsx          # PIN entry page
├── brand-ops/page.tsx    # Cross-brand action board + editable ACoS goals
├── rpd-walmart/page.tsx  # RPD Walmart report
├── elevate/page.tsx      # Elevate Beverages report
├── rpd-hd/page.tsx       # RPD Home Depot report
├── api/
│   ├── auth/route.ts     # POST: validate PIN, set cookie
│   ├── acos-goals/route.ts # GET + POST ACoS goals
│   ├── upload/[company]/ # POST: file upload handler
│   └── notes/[company]/  # GET + POST notes
components/
├── UploadBar.tsx         # File upload UI
├── NotesSection.tsx      # Notes display + add form
└── BrandOpsBoard.tsx     # Cross-brand filters, goals, and signals UI
lib/
├── brandOps.ts           # Cross-brand signal aggregation
├── brandOpsConfig.ts     # Brand/channel keys and labels
├── acosGoals.ts          # Supabase ACoS goal storage helpers
├── parseExcel.ts         # RPD Walmart parser + shared utilities
├── parseElevate.ts       # Elevate Beverages parser
├── parseRpdHd.ts         # RPD Home Depot parser
└── notes.ts              # Notes JSON read/write
data/
├── rpd/latest.xlsx       # RPD Walmart data
├── elevate/latest.xlsx   # Elevate data
├── rpd-hd/latest.xlsx    # RPD-HD data
└── notes/*.json          # Per-client notes
middleware.ts             # PIN cookie auth guard
```

## Tech Stack

- **Next.js 14** (App Router, SSR)
- **React 18** with TypeScript
- **Tailwind CSS 3**
- **xlsx** npm package for server-side Excel parsing
- **No database** — data stored as Excel + JSON files in `data/`
- **Supabase** for notes + editable cross-brand ACoS goals
- Runs locally via `npm run dev`
