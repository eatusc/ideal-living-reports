const XLSX = require('../node_modules/xlsx');
const path = require('path');

const dir = __dirname;

// 1. keywords_0205.xlsx - unique Campaign names
console.log('='.repeat(80));
console.log('1. keywords_0205.xlsx — Unique Campaign Names (Column D / "Campaign")');
console.log('='.repeat(80));
const kwWb = XLSX.readFile(path.join(dir, 'keywords_0205.xlsx'));
const kwSheet = kwWb.Sheets[kwWb.SheetNames[0]];
const kwData = XLSX.utils.sheet_to_json(kwSheet);
console.log('Sheet name:', kwWb.SheetNames[0]);
console.log('Total rows:', kwData.length);
console.log('Headers:', Object.keys(kwData[0]));
// Find campaign column
const kwHeaders = Object.keys(kwData[0]);
const campaignCol = kwHeaders.find(h => /campaign/i.test(h));
console.log('Campaign column found:', campaignCol);
if (campaignCol) {
  const uniqueCampaigns = [...new Set(kwData.map(r => r[campaignCol]).filter(Boolean))];
  console.log(`\nUnique Campaigns (${uniqueCampaigns.length}):`);
  uniqueCampaigns.forEach(c => console.log('  -', c));
}

// 2. searchterms_0205.xlsx - unique Campaigns
console.log('\n' + '='.repeat(80));
console.log('2. searchterms_0205.xlsx — Unique Campaign Names ("Campaigns" column)');
console.log('='.repeat(80));
const stWb = XLSX.readFile(path.join(dir, 'searchterms_0205.xlsx'));
const stSheet = stWb.Sheets[stWb.SheetNames[0]];
const stData = XLSX.utils.sheet_to_json(stSheet);
console.log('Sheet name:', stWb.SheetNames[0]);
console.log('Total rows:', stData.length);
console.log('Headers:', Object.keys(stData[0]));
const stCampaignCol = Object.keys(stData[0]).find(h => /campaign/i.test(h));
console.log('Campaign column found:', stCampaignCol);
if (stCampaignCol) {
  const uniqueST = [...new Set(stData.map(r => r[stCampaignCol]).filter(Boolean))];
  console.log(`\nUnique Campaigns (${uniqueST.length}):`);
  uniqueST.forEach(c => console.log('  -', c));
}

// 3. Brand vs Non Brand - "Brand vs Non-Brand Summary" sheet
console.log('\n' + '='.repeat(80));
console.log('3. "Walmart Brand vs Non Brand - 2025.xlsx" — "Brand vs Non-Brand Summary" sheet');
console.log('='.repeat(80));
const bvWb = XLSX.readFile(path.join(dir, 'Walmart Brand vs Non Brand - 2025.xlsx'));
console.log('All sheet names:', bvWb.SheetNames);

const summarySheet = bvWb.Sheets['Brand vs Non-Brand Summary'];
if (summarySheet) {
  const summaryData = XLSX.utils.sheet_to_json(summarySheet);
  console.log('Total rows:', summaryData.length);
  console.log('Headers:', Object.keys(summaryData[0] || {}));

  const brandCol = Object.keys(summaryData[0] || {}).find(h => /brand\s*name/i.test(h));
  const periodCol = Object.keys(summaryData[0] || {}).find(h => /period/i.test(h));

  if (brandCol) {
    const uniqueBrands = [...new Set(summaryData.map(r => r[brandCol]).filter(Boolean))];
    console.log(`\nUnique Brand Names (${uniqueBrands.length}):`);
    uniqueBrands.forEach(b => console.log('  -', b));
  }
  if (periodCol) {
    const uniquePeriods = [...new Set(summaryData.map(r => r[periodCol]).filter(Boolean))];
    console.log(`\nUnique Periods (${uniquePeriods.length}):`);
    uniquePeriods.forEach(p => console.log('  -', p));
  }

  // Sample rows per brand
  if (brandCol) {
    const brands = [...new Set(summaryData.map(r => r[brandCol]).filter(Boolean))];
    brands.forEach(brand => {
      const rows = summaryData.filter(r => r[brandCol] === brand);
      console.log(`\nSample rows for brand "${brand}" (showing up to 3 of ${rows.length}):`);
      rows.slice(0, 3).forEach(r => console.log('  ', JSON.stringify(r)));
    });
  }
} else {
  console.log('Sheet "Brand vs Non-Brand Summary" not found!');
}

// 4. "All Search Terms" sheet
console.log('\n' + '='.repeat(80));
console.log('4. "Walmart Brand vs Non Brand - 2025.xlsx" — "All Search Terms" sheet');
console.log('='.repeat(80));
const allSTSheet = bvWb.Sheets['All Search Terms'];
if (allSTSheet) {
  const allSTData = XLSX.utils.sheet_to_json(allSTSheet);
  console.log('Total rows:', allSTData.length);
  console.log('Headers:', Object.keys(allSTData[0] || {}));

  const bvnbCol = Object.keys(allSTData[0] || {}).find(h => /brand.*non.*brand/i.test(h));
  const sourceCol = Object.keys(allSTData[0] || {}).find(h => /source/i.test(h));
  const matchCol = Object.keys(allSTData[0] || {}).find(h => /match\s*type/i.test(h));

  console.log('\nColumn matches found: bvnb=', bvnbCol, 'source=', sourceCol, 'match=', matchCol);

  if (bvnbCol) {
    const uniqueBVNB = [...new Set(allSTData.map(r => r[bvnbCol]).filter(v => v !== undefined && v !== null))];
    console.log(`\nUnique "Brand / Non-Brand" values (${uniqueBVNB.length}):`);
    uniqueBVNB.forEach(v => console.log('  -', JSON.stringify(v)));

    // Sample branded rows
    const branded = allSTData.filter(r => /brand/i.test(String(r[bvnbCol])) && !/non/i.test(String(r[bvnbCol])));
    console.log(`\nSample BRANDED rows (10 of ${branded.length}):`);
    branded.slice(0, 10).forEach(r => console.log('  ', JSON.stringify(r)));

    // Sample non-branded rows
    const nonBranded = allSTData.filter(r => /non/i.test(String(r[bvnbCol])));
    console.log(`\nSample NON-BRANDED rows (10 of ${nonBranded.length}):`);
    nonBranded.slice(0, 10).forEach(r => console.log('  ', JSON.stringify(r)));
  }

  if (sourceCol) {
    const uniqueSource = [...new Set(allSTData.map(r => r[sourceCol]).filter(v => v !== undefined && v !== null))];
    console.log(`\nUnique "Source" values (${uniqueSource.length}):`);
    uniqueSource.forEach(v => console.log('  -', JSON.stringify(v)));
  }

  if (matchCol) {
    const uniqueMatch = [...new Set(allSTData.map(r => r[matchCol]).filter(v => v !== undefined && v !== null))];
    console.log(`\nUnique "Match Type" values (${uniqueMatch.length}):`);
    uniqueMatch.forEach(v => console.log('  -', JSON.stringify(v)));
  }
} else {
  console.log('Sheet "All Search Terms" not found!');
}

// 5. Compare headers across keyword files
console.log('\n' + '='.repeat(80));
console.log('5. Header comparison: keywords_0205 vs keywords_0101 vs keywords_1231 only vs keywords_1231 to 0106');
console.log('='.repeat(80));

const files = [
  'keywords_0205.xlsx',
  'keywords_0101.xlsx',
  'keywords_1231 only.xlsx',
  'keywords_1231 to 0106.xlsx'
];

files.forEach(f => {
  try {
    const wb = XLSX.readFile(path.join(dir, f));
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);
    console.log(`\n${f}:`);
    console.log('  Sheet:', wb.SheetNames[0]);
    console.log('  Rows:', data.length);
    console.log('  Headers:', Object.keys(data[0] || {}));
  } catch (e) {
    console.log(`\n${f}: ERROR - ${e.message}`);
  }
});
