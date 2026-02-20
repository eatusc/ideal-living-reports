# Ideal Living — Walmart Weekly Performance Dashboard

A Next.js static dashboard that reads directly from an Excel file at build time to render a Walmart Ads weekly performance report for Ideal Living.

## What This Is

A server-rendered, statically exported Next.js app that:
- Reads `data/Ideal_Living___Walmart_Sales_and_Advertising.xlsx` at build time
- Parses weekly PPC sales + advertising data by brand (via the `xlsx` npm package)
- Renders a dark-themed dashboard with scorecards, trend tables, brand breakdowns, and auto-generated wins/alerts
- Deploys as a static site on Vercel (no database, no API, no auth required)

## Run Locally

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## How to Update the Data

1. Export the latest Excel file from Walmart Seller Center / Intentwise
2. Rename it to `Ideal_Living___Walmart_Sales_and_Advertising.xlsx`
3. Replace `data/Ideal_Living___Walmart_Sales_and_Advertising.xlsx` with the new file
4. Push to GitHub — Vercel will automatically rebuild and redeploy

The Excel file must preserve the sheet name `WALMART_weekly_reporting_2026-B` and the same column structure (headers at row 10, data from row 12).

## How to Update Campaign Notes

The "Campaign Activity This Week" section is a static list of bullet points in the code.

To update it:
1. Open `app/page.tsx`
2. Find the campaign notes array near the bottom of the file (look for `// ── CAMPAIGN NOTES`)
3. Edit the bullet point strings inside the array
4. Push to GitHub to redeploy

## Project Structure

```
├── app/
│   ├── layout.tsx          # Root layout with fonts + metadata
│   ├── page.tsx            # Main dashboard page (server component)
│   └── globals.css         # Tailwind base styles
├── lib/
│   └── parseExcel.ts       # Excel parsing logic + formatting utilities
├── data/
│   └── Ideal_Living___Walmart_Sales_and_Advertising.xlsx
├── next.config.js          # Static export config
├── tailwind.config.ts
└── package.json
```

## Tech Stack

- **Next.js 14** (App Router, static export)
- **Tailwind CSS** for styling
- **xlsx** npm package for server-side Excel parsing
- **DM Sans + DM Mono** via Google Fonts
- Deployed on **Vercel**
