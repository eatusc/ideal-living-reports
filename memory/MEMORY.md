# Project Memory — Ideal Living Dashboard

## Architecture
- **Next.js 14 App Router, SSR** (no static export — removed `output: 'export'` to enable API routes)
- Local-only app (`npm run dev`), file uploads write to local filesystem
- PIN-protected routes: `/rpd-walmart`, `/elevate`, `/rpd-hd` (PIN: "1157", in `app/api/auth/route.ts`)
- Report pages use `export const dynamic = 'force-dynamic'` to ensure fresh Excel reads after upload

## Three Reports
| Route | Client | Parser | Data Path |
|-------|--------|--------|-----------|
| `/rpd-walmart` | Ideal Living (Walmart PPC + SEM) | `lib/parseExcel.ts` | `data/rpd/latest.xlsx` |
| `/elevate` | Elevate Beverages (Amazon + Walmart + SEM) | `lib/parseElevate.ts` | `data/elevate/latest.xlsx` |
| `/rpd-hd` | RPD Home Depot (Orange Access) | `lib/parseRpdHd.ts` | `data/rpd-hd/latest.xlsx` |

## Key Files
- `middleware.ts` — PIN cookie auth guard
- `components/UploadBar.tsx` — upload + reload UI (client)
- `components/NotesSection.tsx` — notes view + add form (client)
- `lib/notes.ts` — notes JSON helpers
- `app/api/upload/[company]/route.ts` — saves to `latest.xlsx` + dated backup
- `app/api/notes/[company]/route.ts` — GET + POST notes

## Data Structure
- Shared utilities in `lib/parseExcel.ts`: `safeNum`, `safeRate`, `fmtDollar`, `fmtPct`, `fmtRoas`, `wowPct`, `acosClass` (all exported)
- RPD Walmart: uses "Current Week"/"Previous Week" row markers in col[1]
- Elevate + RPD-HD: numbered week labels ("2026 - Week N") — last two weeks = current/prev
- Notes stored as JSON arrays: `[{date, action, doneBy}]` in `data/notes/[company].json`

## Color Accents per Report
- RPD Walmart: `#0071CE` (Walmart blue) + `#FFC220` (Walmart yellow)
- Elevate: `#FF9900` (Amazon orange)
- RPD-HD: `#F96302` (Home Depot orange)
