import { NextRequest, NextResponse } from 'next/server';
import { readNotes, appendNote, updateNote, deleteNote, isValidCompany } from '@/lib/notes';

export async function GET(
  _request: NextRequest,
  { params }: { params: { company: string } }
) {
  const { company } = params;
  if (!isValidCompany(company)) {
    return NextResponse.json({ error: 'Invalid company' }, { status: 400 });
  }
  const notes = await readNotes(company);
  return NextResponse.json(notes);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { company: string } }
) {
  const { company } = params;
  if (!isValidCompany(company)) {
    return NextResponse.json({ error: 'Invalid company' }, { status: 400 });
  }

  let body: { date?: string; action?: string; doneBy?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { date, action, doneBy } = body;
  if (!date || !action || !doneBy) {
    return NextResponse.json({ error: 'date, action, and doneBy are required' }, { status: 400 });
  }

  try {
    const note = await appendNote(company, { date: date.trim(), action: action.trim(), doneBy: doneBy.trim() });
    return NextResponse.json({ ok: true, note });
  } catch (err) {
    console.error('Failed to save note:', err);
    return NextResponse.json({ error: 'Failed to save note' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { company: string } }
) {
  const { company } = params;
  if (!isValidCompany(company)) {
    return NextResponse.json({ error: 'Invalid company' }, { status: 400 });
  }

  let body: { id?: string; date?: string; action?: string; doneBy?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { id, date, action, doneBy } = body;
  if (!id || !date || !action || !doneBy) {
    return NextResponse.json({ error: 'id, date, action, and doneBy are required' }, { status: 400 });
  }

  try {
    const ok = await updateNote(company, id, { date: date.trim(), action: action.trim(), doneBy: doneBy.trim() });
    if (!ok) return NextResponse.json({ error: 'Note not found' }, { status: 404 });
  } catch (err) {
    console.error('Failed to update note:', err);
    return NextResponse.json({ error: 'Failed to update note' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { company: string } }
) {
  const { company } = params;
  if (!isValidCompany(company)) {
    return NextResponse.json({ error: 'Invalid company' }, { status: 400 });
  }

  let body: { id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { id } = body;
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  try {
    const ok = await deleteNote(company, id);
    if (!ok) return NextResponse.json({ error: 'Note not found' }, { status: 404 });
  } catch (err) {
    console.error('Failed to delete note:', err);
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
