import { list, getDownloadUrl } from '@vercel/blob';
import fs from 'fs';
import path from 'path';

// Maps company slug → local data folder name
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
 * Local fallback (no BLOB_READ_WRITE_TOKEN):
 *   data/rpd/latest.xlsx
 *   data/elevate/latest.xlsx
 *   data/rpd-hd/latest.xlsx
 */
export async function getExcelBuffer(company: string): Promise<Buffer> {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const { blobs } = await list({ prefix: `${company}/latest.xlsx` });
      if (blobs.length === 0) {
        throw new Error(`No file uploaded yet for "${company}". Upload an Excel file to get started.`);
      }
      // getDownloadUrl generates a signed URL that works for both private and public stores
      const downloadUrl = await getDownloadUrl(blobs[0].url);
      const res = await fetch(downloadUrl);
      if (!res.ok) throw new Error(`Failed to fetch "${company}" data from storage (${res.status})`);
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Blob read failed for "${company}": ${message}`);
    }
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
