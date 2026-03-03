const XLSX = require('../node_modules/xlsx');
const fs = require('fs');
const path = require('path');

// ── Brand definitions ──────────────────────────────────────────────
const BRANDS = [
  { name: 'AirDoctor',       patterns: ['airdoctor', 'air doctor', 'ad3500', 'ad3000', 'ad5500', 'ad2000', 'ad1000', 'ad 3500', 'ad 3000', 'ad 5500', 'ad 2000', 'ad 1000'] },
  { name: 'AquaTru',         patterns: ['aquatru', 'aqua tru', 'aqua true'] },
  { name: 'AromaTru',        patterns: ['aromatru', 'aroma tru'] },
  { name: 'Beflexible',      patterns: ['beflexible', 'be flexible'] },
  { name: 'Better Bladder',  patterns: ['better bladder'] },
  { name: 'Ideal Prostate',  patterns: ['ideal prostate', 'prostate ideal'] },
  { name: 'Ionic Pro',       patterns: ['ionic pro'] },
  { name: 'Miracle Blade',   patterns: ['miracle blade'] },
  { name: 'Paint Zoom',      patterns: ['paint zoom', 'paintzoom'] },
  { name: 'Profemin',        patterns: ['profemin'] },
  { name: 'Prosvent',        patterns: ['prosvent'] },
  { name: 'Rotorazer Saw',   patterns: ['rotorazer', 'roto razer'] },
  { name: 'SaniTru',         patterns: ['sanitru', 'sani tru'] },
  { name: 'Superthotics',    patterns: ['superthotics', 'super thotics', 'superthotic', 'super orthotic'] },
  { name: 'Therabotanics',   patterns: ['therabotanics'] },
  { name: 'WalkFit',         patterns: ['walkfit', 'walk fit'] },
  { name: 'Ultmax',          patterns: ['ultmax'] },
];

// Additional brand names that might appear in campaigns but aren't in the managed list
const EXTRA_CAMPAIGN_BRANDS = [
  { name: 'Grown American', patterns: ['grown american'] },
];

const ALL_BRANDS = [...BRANDS, ...EXTRA_CAMPAIGN_BRANDS];

// ── Helpers ────────────────────────────────────────────────────────
function parseDollar(val) {
  if (val == null) return 0;
  if (typeof val === 'number') return val;
  const s = val.toString().replace(/[$,]/g, '').trim();
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function parseNum(val) {
  if (val == null) return 0;
  if (typeof val === 'number') return val;
  const s = val.toString().replace(/[,$%]/g, '').trim();
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function fmtDollar(n) {
  return '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function fmtPct(n) {
  return (n * 100).toFixed(1) + '%';
}

/** Determine which brand a campaign belongs to */
function brandFromCampaign(campaign) {
  if (!campaign) return 'Unknown';
  const c = campaign.toLowerCase();
  for (const b of ALL_BRANDS) {
    for (const p of b.patterns) {
      if (c.includes(p)) return b.name;
    }
  }
  return 'Unknown';
}

/** Check if a search term is branded (contains the brand name) */
function isBranded(searchTerm, brandName) {
  if (!searchTerm || !brandName) return false;
  const term = searchTerm.toLowerCase().trim();
  const brand = ALL_BRANDS.find(b => b.name === brandName) || BRANDS.find(b => b.name === brandName);
  if (!brand) return false;
  for (const p of brand.patterns) {
    if (term.includes(p)) return true;
  }
  return false;
}

/** Extract week date from filename like keywords_0205.xlsx → "02/05/2025" */
function weekFromFilename(filename) {
  // Handle special cases
  if (filename.includes('1231 only')) return '12/31/2025';
  if (filename.includes('1231 to 0106')) return '12/31/2025';

  const match = filename.match(/(\d{4})\.xlsx$/);
  if (match) {
    const mmdd = match[1];
    const mm = mmdd.substring(0, 2);
    const dd = mmdd.substring(2, 4);
    return `${mm}/${dd}/2025`;
  }
  return 'Unknown';
}

/** Sort week strings chronologically */
function sortWeeks(a, b) {
  const [am, ad] = a.split('/').map(Number);
  const [bm, bd] = b.split('/').map(Number);
  return am !== bm ? am - bm : ad - bd;
}

// ── File discovery ─────────────────────────────────────────────────
const dir = __dirname;
const allFiles = fs.readdirSync(dir);
const keywordFiles = allFiles.filter(f => f.startsWith('keywords_') && f.endsWith('.xlsx') && !f.startsWith('~$') && !f.includes('to 0106'));
const searchtermFiles = allFiles.filter(f => f.startsWith('searchterms_') && f.endsWith('.xlsx') && !f.startsWith('~$') && !f.includes('to 0106'));

console.log(`Found ${keywordFiles.length} keyword files and ${searchtermFiles.length} searchterm files`);

// ── Data collection ────────────────────────────────────────────────
// Each record: { searchTerm, campaign, matchType, source, brandName, brandOrNon, units, revenue, adSpend, week }
const allRecords = [];

// Process keyword files
for (const file of keywordFiles) {
  const week = weekFromFilename(file);
  console.log(`Processing ${file} → week ${week}`);

  const wb = XLSX.readFile(path.join(dir, file));
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

  if (data.length < 2) continue;

  const headers = data[0];
  const isWideFormat = headers.some(h => h && h.toString().includes('Current Spend'));

  // Column mapping
  let colKeyword, colMatchType, colCampaign, colSpend, colRevenue, colUnits;

  if (isWideFormat) {
    // keywords_0101 format with Current/Previous columns
    colKeyword = headers.indexOf('Keywords');
    colMatchType = headers.indexOf('Match Type');
    colCampaign = headers.indexOf('Campaign');
    colSpend = headers.indexOf('Current Spend');
    colRevenue = headers.indexOf('Current Ad Revenue');
    colUnits = headers.indexOf('Current Units');
  } else {
    colKeyword = headers.indexOf('Keywords');
    colMatchType = headers.indexOf('Match Type');
    colCampaign = headers.indexOf('Campaign');
    colSpend = headers.indexOf('Spend');
    colRevenue = headers.indexOf('Ad Revenue');
    colUnits = headers.indexOf('Units');
  }

  // Skip row 1 (totals row) - start at row 2
  for (let i = 2; i < data.length; i++) {
    const row = data[i];
    const keyword = row[colKeyword];
    if (!keyword || keyword.toString().trim() === '') continue;

    const campaign = row[colCampaign] || '';
    const matchType = (row[colMatchType] || '').toString().toLowerCase();
    const brand = brandFromCampaign(campaign);
    const branded = isBranded(keyword.toString(), brand);

    allRecords.push({
      searchTerm: keyword.toString().trim(),
      campaign: campaign.toString().trim(),
      matchType: matchType,
      source: 'Keyword Campaign',
      brandName: brand,
      brandOrNon: branded ? 'Brand' : 'Non-Brand',
      units: parseNum(row[colUnits]),
      revenue: parseDollar(row[colRevenue]),
      adSpend: parseDollar(row[colSpend]),
      week: week,
    });
  }
}

// Process searchterm files - ONLY "unknown" match type
for (const file of searchtermFiles) {
  const week = weekFromFilename(file);
  console.log(`Processing ${file} → week ${week} (unknown only)`);

  const wb = XLSX.readFile(path.join(dir, file));
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

  if (data.length < 2) continue;

  const headers = data[0];
  const colSearchTerm = headers.indexOf('Search Term');
  const colMatchType = headers.indexOf('Match Type');
  const colCampaign = headers.indexOf('Campaigns');
  const colSpend = headers.indexOf('Spend');
  const colRevenue = headers.indexOf('Ad Revenue');
  const colUnits = headers.indexOf('Units');

  // Skip row 1 (totals) - start at row 2
  for (let i = 2; i < data.length; i++) {
    const row = data[i];
    const matchType = (row[colMatchType] || '').toString().toLowerCase().trim();

    if (matchType !== 'unknown') continue;

    const searchTerm = row[colSearchTerm];
    if (!searchTerm || searchTerm.toString().trim() === '') continue;

    const campaign = row[colCampaign] || '';
    const brand = brandFromCampaign(campaign);
    const branded = isBranded(searchTerm.toString(), brand);

    allRecords.push({
      searchTerm: searchTerm.toString().trim(),
      campaign: campaign.toString().trim(),
      matchType: 'Auto',
      source: 'Auto Campaign',
      brandName: brand,
      brandOrNon: branded ? 'Brand' : 'Non-Brand',
      units: parseNum(row[colUnits]),
      revenue: parseDollar(row[colRevenue]),
      adSpend: parseDollar(row[colSpend]),
      week: week,
    });
  }
}

console.log(`\nTotal records collected: ${allRecords.length}`);
console.log(`  From keyword campaigns: ${allRecords.filter(r => r.source === 'Keyword Campaign').length}`);
console.log(`  From auto campaigns: ${allRecords.filter(r => r.source === 'Auto Campaign').length}`);

// Count by brand
const brandCounts = {};
allRecords.forEach(r => {
  brandCounts[r.brandName] = (brandCounts[r.brandName] || 0) + 1;
});
console.log('\nRecords by brand:');
Object.entries(brandCounts).sort((a,b) => b[1]-a[1]).forEach(([b,c]) => console.log(`  ${b}: ${c}`));

// Count branded vs non-branded
const brandedCount = allRecords.filter(r => r.brandOrNon === 'Brand').length;
const nonBrandedCount = allRecords.filter(r => r.brandOrNon === 'Non-Brand').length;
console.log(`\nBranded: ${brandedCount}, Non-Branded: ${nonBrandedCount}`);

// ── Build output workbook ──────────────────────────────────────────
const outWb = XLSX.utils.book_new();

// ── TAB 1: Brand vs Non-Brand Summary (Full Year) ─────────────────
const summaryRows = [['Brand Name', 'Period', 'Brand / Non-Brand', 'Units', 'Revenue ($)', 'Ad Spend ($)', '% of Brand\'s Revenue', '% of Total Revenue']];

const totalRevenue = allRecords.reduce((s, r) => s + r.revenue, 0);

// Group by brand, then by branded/non-branded
const brandGroups = {};
allRecords.forEach(r => {
  if (!brandGroups[r.brandName]) brandGroups[r.brandName] = { Brand: [], 'Non-Brand': [] };
  brandGroups[r.brandName][r.brandOrNon].push(r);
});

let totalBrandUnits = 0, totalBrandRevenue = 0, totalBrandSpend = 0;
let totalNonBrandUnits = 0, totalNonBrandRevenue = 0, totalNonBrandSpend = 0;

const sortedBrands = Object.keys(brandGroups).sort();
for (const brand of sortedBrands) {
  const group = brandGroups[brand];
  const brandRecs = group['Brand'];
  const nonBrandRecs = group['Non-Brand'];

  const brandUnits = brandRecs.reduce((s, r) => s + r.units, 0);
  const brandRev = brandRecs.reduce((s, r) => s + r.revenue, 0);
  const brandSpend = brandRecs.reduce((s, r) => s + r.adSpend, 0);
  const nbUnits = nonBrandRecs.reduce((s, r) => s + r.units, 0);
  const nbRev = nonBrandRecs.reduce((s, r) => s + r.revenue, 0);
  const nbSpend = nonBrandRecs.reduce((s, r) => s + r.adSpend, 0);

  const brandTotalRev = brandRev + nbRev;

  totalBrandUnits += brandUnits;
  totalBrandRevenue += brandRev;
  totalBrandSpend += brandSpend;
  totalNonBrandUnits += nbUnits;
  totalNonBrandRevenue += nbRev;
  totalNonBrandSpend += nbSpend;

  if (brandUnits > 0 || brandSpend > 0) {
    summaryRows.push([
      brand, 'Full Year 2025', 'Brand',
      brandUnits, fmtDollar(brandRev), fmtDollar(brandSpend),
      brandTotalRev > 0 ? fmtPct(brandRev / brandTotalRev) : '0.0%',
      totalRevenue > 0 ? fmtPct(brandRev / totalRevenue) : '0.0%',
    ]);
  }
  if (nbUnits > 0 || nbSpend > 0) {
    summaryRows.push([
      brand, 'Full Year 2025', 'Non-Brand',
      nbUnits, fmtDollar(nbRev), fmtDollar(nbSpend),
      brandTotalRev > 0 ? fmtPct(nbRev / brandTotalRev) : '0.0%',
      totalRevenue > 0 ? fmtPct(nbRev / totalRevenue) : '0.0%',
    ]);
  }
}

// Grand totals
summaryRows.push([]);
summaryRows.push([
  'GRAND TOTAL', 'Full Year 2025', 'Brand',
  totalBrandUnits, fmtDollar(totalBrandRevenue), fmtDollar(totalBrandSpend),
  '', totalRevenue > 0 ? fmtPct(totalBrandRevenue / totalRevenue) : '0.0%',
]);
summaryRows.push([
  'GRAND TOTAL', 'Full Year 2025', 'Non-Brand',
  totalNonBrandUnits, fmtDollar(totalNonBrandRevenue), fmtDollar(totalNonBrandSpend),
  '', totalRevenue > 0 ? fmtPct(totalNonBrandRevenue / totalRevenue) : '0.0%',
]);

const summaryWs = XLSX.utils.aoa_to_sheet(summaryRows);
summaryWs['!cols'] = [
  { wch: 20 }, { wch: 16 }, { wch: 16 }, { wch: 10 },
  { wch: 14 }, { wch: 14 }, { wch: 20 }, { wch: 18 },
];
XLSX.utils.book_append_sheet(outWb, summaryWs, 'Brand vs Non-Brand Summary');

// ── TAB 2: All Search Terms (aggregated, unique terms) ─────────────
// Aggregate by unique searchTerm + campaign + source + brandName + brandOrNon
const termAgg = {};
allRecords.forEach(r => {
  const key = `${r.searchTerm}|||${r.campaign}|||${r.source}|||${r.brandName}|||${r.brandOrNon}`;
  if (!termAgg[key]) {
    termAgg[key] = { ...r, units: 0, revenue: 0, adSpend: 0 };
  }
  termAgg[key].units += r.units;
  termAgg[key].revenue += r.revenue;
  termAgg[key].adSpend += r.adSpend;
});

const termRows = [['Search Term', 'Campaign', 'Match Type', 'Source', 'Brand Name', 'Brand / Non-Brand', 'Units', 'Revenue ($)', 'Ad Spend ($)']];
const sortedTerms = Object.values(termAgg).sort((a, b) => b.adSpend - a.adSpend);
for (const t of sortedTerms) {
  termRows.push([
    t.searchTerm, t.campaign, t.matchType, t.source, t.brandName, t.brandOrNon,
    t.units, fmtDollar(t.revenue), fmtDollar(t.adSpend),
  ]);
}

const termWs = XLSX.utils.aoa_to_sheet(termRows);
termWs['!cols'] = [
  { wch: 40 }, { wch: 50 }, { wch: 12 }, { wch: 18 }, { wch: 18 },
  { wch: 14 }, { wch: 8 }, { wch: 14 }, { wch: 14 },
];
XLSX.utils.book_append_sheet(outWb, termWs, 'All Search Terms');

// ── TAB 3: Weekly Summary ──────────────────────────────────────────
// One row per week, Brand vs Non-Brand totals across all brands
const weeks = [...new Set(allRecords.map(r => r.week))].sort(sortWeeks);

const weeklySummaryRows = [['Week', 'Brand Units', 'Brand Revenue ($)', 'Brand Ad Spend ($)', 'Non-Brand Units', 'Non-Brand Revenue ($)', 'Non-Brand Ad Spend ($)', 'Total Units', 'Total Revenue ($)', 'Total Ad Spend ($)']];

for (const w of weeks) {
  const weekRecs = allRecords.filter(r => r.week === w);
  const bRecs = weekRecs.filter(r => r.brandOrNon === 'Brand');
  const nbRecs = weekRecs.filter(r => r.brandOrNon === 'Non-Brand');

  const bU = bRecs.reduce((s, r) => s + r.units, 0);
  const bR = bRecs.reduce((s, r) => s + r.revenue, 0);
  const bS = bRecs.reduce((s, r) => s + r.adSpend, 0);
  const nbU = nbRecs.reduce((s, r) => s + r.units, 0);
  const nbR = nbRecs.reduce((s, r) => s + r.revenue, 0);
  const nbS = nbRecs.reduce((s, r) => s + r.adSpend, 0);

  weeklySummaryRows.push([
    w, bU, fmtDollar(bR), fmtDollar(bS), nbU, fmtDollar(nbR), fmtDollar(nbS),
    bU + nbU, fmtDollar(bR + nbR), fmtDollar(bS + nbS),
  ]);
}

const weeklySummaryWs = XLSX.utils.aoa_to_sheet(weeklySummaryRows);
weeklySummaryWs['!cols'] = [
  { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 18 },
  { wch: 16 }, { wch: 22 }, { wch: 22 },
  { wch: 12 }, { wch: 18 }, { wch: 18 },
];
XLSX.utils.book_append_sheet(outWb, weeklySummaryWs, 'Weekly Summary');

// ── TAB 4: Weekly Detail ──────────────────────────────────────────
// One row per week + brand + type, filterable in Excel
const weeklyDetailRows = [['Week', 'Brand Name', 'Brand / Non-Brand', 'Units', 'Revenue ($)', 'Ad Spend ($)']];

for (const w of weeks) {
  for (const brand of sortedBrands) {
    for (const type of ['Brand', 'Non-Brand']) {
      const recs = allRecords.filter(r => r.week === w && r.brandName === brand && r.brandOrNon === type);
      if (recs.length === 0) continue;

      const u = recs.reduce((s, r) => s + r.units, 0);
      const rev = recs.reduce((s, r) => s + r.revenue, 0);
      const spend = recs.reduce((s, r) => s + r.adSpend, 0);

      weeklyDetailRows.push([w, brand, type, u, fmtDollar(rev), fmtDollar(spend)]);
    }
  }
}

const weeklyDetailWs = XLSX.utils.aoa_to_sheet(weeklyDetailRows);
weeklyDetailWs['!cols'] = [
  { wch: 12 }, { wch: 20 }, { wch: 16 }, { wch: 10 }, { wch: 14 }, { wch: 14 },
];
XLSX.utils.book_append_sheet(outWb, weeklyDetailWs, 'Weekly Detail');

// ── TAB 4: Branded Terms List ──────────────────────────────────────
// Show unique branded terms with their brand
const brandedTerms = {};
allRecords.filter(r => r.brandOrNon === 'Brand').forEach(r => {
  const key = r.searchTerm.toLowerCase();
  if (!brandedTerms[key]) {
    brandedTerms[key] = { term: r.searchTerm, brand: r.brandName };
  }
});
const brandedList = Object.values(brandedTerms).sort((a, b) => a.brand.localeCompare(b.brand) || a.term.localeCompare(b.term));

const brandedRows = [['Search Term', 'Brand Name']];
brandedList.forEach(t => brandedRows.push([t.term, t.brand]));

const brandedWs = XLSX.utils.aoa_to_sheet(brandedRows);
brandedWs['!cols'] = [{ wch: 50 }, { wch: 20 }];
XLSX.utils.book_append_sheet(outWb, brandedWs, 'Branded Terms');

// ── TAB 5: Non-Branded Terms List ──────────────────────────────────
// Show unique non-branded terms with their brand (from campaign)
const nonBrandedTerms = {};
allRecords.filter(r => r.brandOrNon === 'Non-Brand').forEach(r => {
  const key = r.searchTerm.toLowerCase();
  if (!nonBrandedTerms[key]) {
    nonBrandedTerms[key] = { term: r.searchTerm, brand: r.brandName };
  }
});
const nonBrandedList = Object.values(nonBrandedTerms).sort((a, b) => a.brand.localeCompare(b.brand) || a.term.localeCompare(b.term));

const nbRows = [['Search Term', 'Brand Name']];
nonBrandedList.forEach(t => nbRows.push([t.term, t.brand]));

const nbWs = XLSX.utils.aoa_to_sheet(nbRows);
nbWs['!cols'] = [{ wch: 60 }, { wch: 20 }];
XLSX.utils.book_append_sheet(outWb, nbWs, 'Non-Branded Terms');

// ── Write output ───────────────────────────────────────────────────
const outPath = path.join(dir, 'Walmart Brand vs Non Brand - 2025 (Weekly).xlsx');
XLSX.writeFile(outWb, outPath);
console.log(`\nOutput written to: ${outPath}`);
console.log(`Tabs: ${outWb.SheetNames.join(', ')}`);
console.log(`Unique branded terms: ${brandedList.length}`);
console.log(`Unique non-branded terms: ${nonBrandedList.length}`);
console.log(`Total weeks: ${weeks.length}`);
console.log(`Weeks: ${weeks.join(', ')}`);
