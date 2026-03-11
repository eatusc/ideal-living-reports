import fs from 'fs';
import path from 'path';

export interface Note {
  date: string;
  action: string;
  doneBy: string;
}

const VALID_COMPANIES = ['rpd-walmart', 'elevate', 'rpd-hd'] as const;
type Company = typeof VALID_COMPANIES[number];

const IS_VERCEL = !!process.env.VERCEL;

function notesDir(): string {
  return IS_VERCEL
    ? path.join('/tmp', 'data', 'notes')
    : path.join(process.cwd(), 'data', 'notes');
}

function notesPath(company: Company): string {
  return path.join(notesDir(), `${company}.json`);
}

export function readNotes(company: Company): Note[] {
  const filePath = notesPath(company);
  if (!fs.existsSync(filePath)) return [];
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as Note[];
  } catch {
    return [];
  }
}

function writeNotes(company: Company, notes: Note[]): void {
  const dir = path.dirname(notesPath(company));
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(notesPath(company), JSON.stringify(notes, null, 2), 'utf-8');
}

export function appendNote(company: Company, note: Note): void {
  const notes = readNotes(company);
  notes.push(note);
  writeNotes(company, notes);
}

export function updateNote(company: Company, index: number, note: Note): boolean {
  const notes = readNotes(company);
  if (index < 0 || index >= notes.length) return false;
  notes[index] = note;
  writeNotes(company, notes);
  return true;
}

export function deleteNote(company: Company, index: number): boolean {
  const notes = readNotes(company);
  if (index < 0 || index >= notes.length) return false;
  notes.splice(index, 1);
  writeNotes(company, notes);
  return true;
}

export function isValidCompany(value: string): value is Company {
  return VALID_COMPANIES.includes(value as Company);
}
