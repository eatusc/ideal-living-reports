import { supabase } from './supabase';
import { unstable_noStore as noStore } from 'next/cache';

export interface Note {
  id: string;
  date: string;
  action: string;
  doneBy: string;
}

interface DbNote {
  id: string;
  company: string;
  date: string;
  action: string;
  done_by: string;
  created_at: string;
}

const VALID_COMPANIES = ['rpd-walmart', 'elevate', 'rpd-hd', 'lustroware', 'somarsh', 'brand-ops'] as const;
type Company = typeof VALID_COMPANIES[number];

function toNote(row: DbNote): Note {
  return { id: row.id, date: row.date, action: row.action, doneBy: row.done_by };
}

export async function readNotes(company: Company): Promise<Note[]> {
  noStore();
  const { data, error } = await supabase
    .from('rpd_notes')
    .select('*')
    .eq('company', company)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Failed to read notes:', error);
    return [];
  }
  return (data as DbNote[]).map(toNote);
}

export async function appendNote(company: Company, note: Omit<Note, 'id'>): Promise<Note | null> {
  const { data, error } = await supabase
    .from('rpd_notes')
    .insert({ company, date: note.date, action: note.action, done_by: note.doneBy })
    .select()
    .single();

  if (error) {
    console.error('Failed to append note:', error);
    throw error;
  }
  return toNote(data as DbNote);
}

export async function updateNote(company: Company, id: string, note: Omit<Note, 'id'>): Promise<boolean> {
  const { error, count } = await supabase
    .from('rpd_notes')
    .update({ date: note.date, action: note.action, done_by: note.doneBy })
    .eq('id', id)
    .eq('company', company);

  if (error) {
    console.error('Failed to update note:', error);
    throw error;
  }
  return (count ?? 1) > 0;
}

export async function deleteNote(company: Company, id: string): Promise<boolean> {
  const { error, count } = await supabase
    .from('rpd_notes')
    .delete()
    .eq('id', id)
    .eq('company', company);

  if (error) {
    console.error('Failed to delete note:', error);
    throw error;
  }
  return (count ?? 1) > 0;
}

export function isValidCompany(value: string): value is Company {
  return VALID_COMPANIES.includes(value as Company);
}
