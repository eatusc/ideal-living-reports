import fs from 'fs';
import path from 'path';

/**
 * Returns the Excel file buffer for a given data directory (e.g. 'rpd', 'elevate', 'rpd-hd').
 * - On Vercel (BLOB_READ_WRITE_TOKEN set): fetches from Vercel Blob storage.
 * - Locally: reads from data/{dir}/latest.xlsx on disk.
 */
export async function getExcelBuffer(dir: string): Promise<Buffer> {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { list } = await import('@vercel/blob');
    const { blobs } = await list({ prefix: `${dir}/latest` });
    if (blobs.length === 0) {
      throw new Error(`No file uploaded yet for ${dir}. Upload an Excel file to get started.`);
    }
    const res = await fetch(blobs[0].url);
    if (!res.ok) throw new Error(`Failed to fetch ${dir} data from storage (${res.status})`);
    return Buffer.from(await res.arrayBuffer());
  }

  // Local dev fallback — read from disk
  const localPath = path.join(process.cwd(), 'data', dir, 'latest.xlsx');
  if (!fs.existsSync(localPath)) {
    throw new Error(`Data file not found at ${localPath}`);
  }
  return fs.readFileSync(localPath);
}
