const XLSX = require('../node_modules/xlsx');
const path = require('path');
const dir = __dirname;

// Check raw cell structure for keywords_0205
console.log('='.repeat(80));
console.log('RAW STRUCTURE: keywords_0205.xlsx');
console.log('='.repeat(80));
const kwWb = XLSX.readFile(path.join(dir, 'keywords_0205.xlsx'));
const kwSheet = kwWb.Sheets[kwWb.SheetNames[0]];
const kwRange = XLSX.utils.decode_range(kwSheet['!ref']);
console.log('Range:', kwSheet['!ref']);

// Print first 5 rows, all columns
for (let r = kwRange.s.r; r <= Math.min(kwRange.s.r + 4, kwRange.e.r); r++) {
  const rowData = {};
  for (let c = kwRange.s.c; c <= Math.min(kwRange.e.c, 10); c++) {
    const addr = XLSX.utils.encode_cell({r, c});
    const cell = kwSheet[addr];
    rowData[XLSX.utils.encode_col(c)] = cell ? cell.v : undefined;
  }
  console.log(`Row ${r}:`, JSON.stringify(rowData));
}

// Now use sheet_to_json with header:1 to get raw arrays
const kwRaw = XLSX.utils.sheet_to_json(kwSheet, {header: 1});
console.log('\nFirst 3 raw rows:');
kwRaw.slice(0, 3).forEach((row, i) => console.log(`  Row ${i}:`, row.slice(0, 8)));

// Get all values from column A (index 0) - these are likely campaign/keyword names
const colAValues = kwRaw.slice(1).map(r => r[0]).filter(Boolean);
const uniqueColA = [...new Set(colAValues)];
console.log(`\nUnique values in Column A (${uniqueColA.length}):`);
uniqueColA.forEach(v => console.log('  -', v));

// Check for merged cells
if (kwSheet['!merges']) {
  console.log('\nMerged cells:', kwSheet['!merges'].length);
  kwSheet['!merges'].slice(0, 10).forEach(m => console.log('  ', XLSX.utils.encode_range(m)));
}

// Now do the same for searchterms_0205
console.log('\n' + '='.repeat(80));
console.log('RAW STRUCTURE: searchterms_0205.xlsx');
console.log('='.repeat(80));
const stWb = XLSX.readFile(path.join(dir, 'searchterms_0205.xlsx'));
const stSheet = stWb.Sheets[stWb.SheetNames[0]];
console.log('Range:', stSheet['!ref']);

const stRaw = XLSX.utils.sheet_to_json(stSheet, {header: 1});
console.log('\nFirst 3 raw rows:');
stRaw.slice(0, 3).forEach((row, i) => console.log(`  Row ${i}:`, row.slice(0, 8)));

// Column A values for searchterms
const stColA = stRaw.slice(1).map(r => r[0]).filter(Boolean);
const uniqueStColA = [...new Set(stColA)];
console.log(`\nUnique values in Column A (first 30 of ${uniqueStColA.length}):`);
uniqueStColA.slice(0, 30).forEach(v => console.log('  -', v));

// Check for merged cells / grouping in columns
if (stSheet['!merges']) {
  console.log('\nMerged cells:', stSheet['!merges'].length);
  stSheet['!merges'].slice(0, 10).forEach(m => console.log('  ', XLSX.utils.encode_range(m)));
}

// Check if there are hidden rows/columns with campaign info
// Let's look at columns A-E for first 10 rows
console.log('\nFirst 10 rows, columns A-E:');
for (let r = 0; r <= Math.min(9, stRaw.length - 1); r++) {
  console.log(`  Row ${r}:`, (stRaw[r] || []).slice(0, 5));
}

// Also check keywords - maybe campaign is in a tree/hierarchy structure
// Let's look at ALL columns for first row of keywords
console.log('\n' + '='.repeat(80));
console.log('KEYWORDS: checking for hierarchy / Campaign grouping');
console.log('='.repeat(80));
const kwAllRaw = XLSX.utils.sheet_to_json(kwSheet, {header: 1});
// Check columns A-D for first 20 rows
console.log('First 20 rows, columns A-D:');
for (let r = 0; r <= Math.min(19, kwAllRaw.length - 1); r++) {
  console.log(`  Row ${r}:`, (kwAllRaw[r] || []).slice(0, 4));
}

// Check if row names contain campaign info (column A used as key by default)
console.log('\nAll row keys from sheet_to_json (default):');
const kwDefault = XLSX.utils.sheet_to_json(kwSheet);
kwDefault.slice(0, 10).forEach((row, i) => {
  // The __rowNum__ or the first key that's not a metric
  const keys = Object.keys(row);
  console.log(`  Row ${i}: first_key="${keys[0]}", row_name="${row[keys[0]]}"`);
});
