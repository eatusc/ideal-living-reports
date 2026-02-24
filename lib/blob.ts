import fs from 'fs';
import path from 'path';

// Maps company slug → local data folder name (mirrors upload route)
const COMPANY_DIRS: Record<string, string> = {
  'rpd-walmart': 'rpd',
  'elevate':     'elevate',
  'rpd-hd':      'rpd-hd',
};

/**
 * Returns the Excel file buffer for a given company slug.
 *
 * Blob keys (Vercel dashboard):
 *   rpd-walmart/latest.xlsx
 *   elevate/latest.xlsx
 *   rpd-hd/latest.xlsx
 *
 * Local fallback:
 *   data/rpd/latest.xlsx
 *   data/elevate/latest.xlsx
 *   data/rpd-hd/latest.xlsx
 */
export async function getExcelBuffer(company: string): Promise<Buffer> {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { list } = await import('@vercel/blob');
    // Exact prefix match: 'rpd-walmart/latest.xlsx'
    const { blobs } = await list({ prefix: `${company}/latest.xlsx` });
    if (blobs.length === 0) {
      throw new Error(`No file uploaded yet for "${company}". Upload an Excel file to get started.`);
    }
    const res = await fetch(blobs[0].url);
    if (!res.ok) throw new Error(`Failed to fetch "${company}" data from storage (${res.status})`);
    return Buffer.from(await res.arrayBuffer());
  }

  // Local dev fallback — read from disk
  const dir = COMPANY_DIRS[company];
  if (!dir) throw new Error(`Unknown company: ${company}`);
  const localPath = path.join(process.cwd(), 'data', dir, 'latest.xlsx');
  if (!fs.existsSync(localPath)) {
    throw new Error(`Data file not found at ${localPath}`);
  }
  return fs.readFileSync(localPath);
}
