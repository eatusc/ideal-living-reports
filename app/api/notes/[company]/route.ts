import { NextRequest, NextResponse } from 'next/server';
import { readNotes, appendNote, updateNote, deleteNote, isValidCompany, type Note } from '@/lib/notes';

export async function GET(
  _request: NextRequest,
  { params }: { params: { company: string } }
) {
  const { company } = params;
  if (!isValidCompany(company)) {
    return NextResponse.json({ error: 'Invalid company' }, { status: 400 });
  }
  const notes = readNotes(company);
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

  let body: Partial<Note>;
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
    appendNote(company, { date: date.trim(), action: action.trim(), doneBy: doneBy.trim() });
  } catch (err) {
    console.error('Failed to save note:', err);
    return NextResponse.json({ error: 'Failed to write note to disk' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { company: string } }
) {
  const { company } = params;
  if (!isValidCompany(company)) {
    return NextResponse.json({ error: 'Invalid company' }, { status: 400 });
  }

  let body: Partial<Note> & { index?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { index, date, action, doneBy } = body;
  if (index === undefined || !date || !action || !doneBy) {
    return NextResponse.json({ error: 'index, date, action, and doneBy are required' }, { status: 400 });
  }

  try {
    const ok = updateNote(company, index, { date: date.trim(), action: action.trim(), doneBy: doneBy.trim() });
    if (!ok) return NextResponse.json({ error: 'Note not found' }, { status: 404 });
  } catch (err) {
    console.error('Failed to update note:', err);
    return NextResponse.json({ error: 'Failed to write note to disk' }, { status: 500 });
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

  let body: { index?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { index } = body;
  if (index === undefined) {
    return NextResponse.json({ error: 'index is required' }, { status: 400 });
  }

  try {
    const ok = deleteNote(company, index);
    if (!ok) return NextResponse.json({ error: 'Note not found' }, { status: 404 });
  } catch (err) {
    console.error('Failed to delete note:', err);
    return NextResponse.json({ error: 'Failed to write note to disk' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
