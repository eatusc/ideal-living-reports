const XLSX = require('../node_modules/xlsx');
const path = require('path');
const dir = __dirname;

// 1. keywords_0205.xlsx - unique Campaign names (column E = index 3 in raw array starting from B)
console.log('='.repeat(80));
console.log('1. keywords_0205.xlsx — ALL Unique Campaign Names');
console.log('='.repeat(80));
const kwWb = XLSX.readFile(path.join(dir, 'keywords_0205.xlsx'));
const kwRaw = XLSX.utils.sheet_to_json(kwWb.Sheets[kwWb.SheetNames[0]], {header: 1});
console.log('Headers:', kwRaw[0]);
console.log('Total data rows:', kwRaw.length - 1);
// Campaign is at index 3 (col E in 0-indexed from col B start)
const kwCampaigns = [...new Set(kwRaw.slice(1).map(r => r[3]).filter(Boolean))];
console.log(`\nUnique Campaigns (${kwCampaigns.length}):`);
kwCampaigns.sort().forEach(c => console.log('  -', c));

// 2. searchterms_0205.xlsx - unique Campaigns (column F = index 4 in raw)
console.log('\n' + '='.repeat(80));
console.log('2. searchterms_0205.xlsx — ALL Unique Campaign Names');
console.log('='.repeat(80));
const stWb = XLSX.readFile(path.join(dir, 'searchterms_0205.xlsx'));
const stRaw = XLSX.utils.sheet_to_json(stWb.Sheets[stWb.SheetNames[0]], {header: 1});
console.log('Headers:', stRaw[0]);
console.log('Total data rows:', stRaw.length - 1);
// Campaigns is at index 4
const stCampaigns = [...new Set(stRaw.slice(1).map(r => r[4]).filter(Boolean))];
console.log(`\nUnique Campaigns (${stCampaigns.length}):`);
stCampaigns.sort().forEach(c => console.log('  -', c));

// 3 & 4 already done in first script - just re-summarize
console.log('\n' + '='.repeat(80));
console.log('3 & 4. Brand vs Non Brand file — already shown above');
console.log('='.repeat(80));

// 5. Header comparison
console.log('\n' + '='.repeat(80));
console.log('5. Header comparison across keyword files');
console.log('='.repeat(80));
const files = [
  'keywords_0205.xlsx',
  'keywords_0101.xlsx',
  'keywords_1231 only.xlsx',
  'keywords_1231 to 0106.xlsx'
];
files.forEach(f => {
  const wb = XLSX.readFile(path.join(dir, f));
  const raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {header: 1});
  const range = wb.Sheets[wb.SheetNames[0]]['!ref'];
  console.log(`\n${f}:`);
  console.log('  Range:', range);
  console.log('  Rows:', raw.length);
  console.log('  Headers:', raw[0]);
});
