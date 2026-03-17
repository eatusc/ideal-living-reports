'use client';

import { useState, useEffect, useCallback } from 'react';

interface Note {
  id: string;
  date: string;
  action: string;
  doneBy: string;
}

interface NotesSectionProps {
  company: 'rpd-walmart' | 'elevate' | 'rpd-hd';
}

const DEFAULT_DONE_BY = 'admin';

export default function NotesSection({ company }: NotesSectionProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Add form state
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [action, setAction] = useState('');
  const [doneBy, setDoneBy] = useState(DEFAULT_DONE_BY);

  // Edit state — tracks the note id being edited
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editAction, setEditAction] = useState('');
  const [editDoneBy, setEditDoneBy] = useState(DEFAULT_DONE_BY);
  const [editError, setEditError] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Delete confirmation state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchNotes = useCallback(async () => {
    try {
      const res = await fetch(`/api/notes/${company}`);
      const data: Note[] = await res.json();
      setNotes(data.slice().reverse()); // newest first
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [company]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  // Add note
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!action.trim() || !doneBy.trim()) {
      setFormError('Action and Done By are required');
      return;
    }
    setSubmitting(true);
    setFormError('');
    try {
      const res = await fetch(`/api/notes/${company}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, action: action.trim(), doneBy: doneBy.trim() }),
      });
      if (res.ok) {
        setAction('');
        setDoneBy(DEFAULT_DONE_BY);
        setDate(today);
        setShowForm(false);
        await fetchNotes();
      } else {
        const data = await res.json();
        setFormError(data.error ?? 'Failed to save note');
      }
    } catch {
      setFormError('Network error — please try again');
    } finally {
      setSubmitting(false);
    }
  }

  // Open edit form for a note
  function openEdit(note: Note) {
    setEditingId(note.id);
    setEditDate(note.date);
    setEditAction(note.action);
    setEditDoneBy(note.doneBy || DEFAULT_DONE_BY);
    setEditError('');
    setDeletingId(null);
  }

  // Save edit
  async function handleEditSave(id: string) {
    if (!editAction.trim() || !editDoneBy.trim()) {
      setEditError('Action and Done By are required');
      return;
    }
    setEditSubmitting(true);
    setEditError('');
    try {
      const res = await fetch(`/api/notes/${company}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, date: editDate, action: editAction.trim(), doneBy: editDoneBy.trim() }),
      });
      if (res.ok) {
        setEditingId(null);
        await fetchNotes();
      } else {
        const data = await res.json();
        setEditError(data.error ?? 'Failed to update note');
      }
    } catch {
      setEditError('Network error — please try again');
    } finally {
      setEditSubmitting(false);
    }
  }

  // Delete a note
  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/notes/${company}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setDeletingId(null);
        setEditingId(null);
        await fetchNotes();
      }
    } catch {
      // silently fail
    }
  }

  return (
    <div className="mt-9">
      <div className="flex items-center justify-between mb-4">
        <div className="text-[11px] font-bold uppercase tracking-[1.5px] text-[#FFC220]">
          📝 Campaign Notes
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setFormError(''); }}
          className="text-[11px] font-medium text-blue-400 hover:text-blue-300 transition-colors border border-blue-400/30 hover:border-blue-400/50 rounded px-2.5 py-1"
        >
          {showForm ? '✕ Cancel' : '+ Add Note'}
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-dash-card border border-white/[0.08] border-l-[3px] border-l-blue-400 rounded-lg p-4 mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-[10px] font-medium uppercase tracking-[0.8px] text-gray-400 mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-dash-card2 border border-white/[0.1] rounded px-2.5 py-1.5 text-[12px] font-mono text-white focus:outline-none focus:border-blue-400/50"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-medium uppercase tracking-[0.8px] text-gray-400 mb-1">Done By</label>
              <input
                type="text"
                value={doneBy}
                onChange={(e) => setDoneBy(e.target.value)}
                placeholder="Your name"
                className="w-full bg-dash-card2 border border-white/[0.1] rounded px-2.5 py-1.5 text-[12px] text-white placeholder-gray-600 focus:outline-none focus:border-blue-400/50"
              />
            </div>
          </div>
          <div className="mb-3">
            <label className="block text-[10px] font-medium uppercase tracking-[0.8px] text-gray-400 mb-1">Action / Note</label>
            <textarea
              value={action}
              onChange={(e) => setAction(e.target.value)}
              placeholder="Describe the campaign action or note…"
              rows={2}
              className="w-full bg-dash-card2 border border-white/[0.1] rounded px-2.5 py-1.5 text-[12px] text-white placeholder-gray-600 resize-none focus:outline-none focus:border-blue-400/50"
            />
          </div>
          {formError && <p className="text-[11px] text-red-400 mb-2">{formError}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-1.5 text-[12px] font-semibold rounded bg-[#FFC220] text-[#0A0F1C] hover:bg-[#FFD050] disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Saving…' : 'Save Note'}
          </button>
        </form>
      )}

      {/* Notes list */}
      <div className="bg-dash-card border border-white/[0.08] rounded-lg overflow-hidden">
        {loading ? (
          <p className="px-4 py-5 text-[12px] text-gray-500">Loading notes…</p>
        ) : notes.length === 0 ? (
          <p className="px-4 py-5 text-[12px] text-gray-500">No notes yet. Click &quot;+ Add Note&quot; to log campaign activity.</p>
        ) : (
          <ul className="divide-y divide-white/[0.05]">
            {notes.map((note) => (
              <li key={note.id} className="px-4 py-3">
                {editingId === note.id ? (
                  /* ── Inline edit form ── */
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="date"
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                        className="bg-dash-card2 border border-white/[0.1] rounded px-2.5 py-1.5 text-[12px] font-mono text-white focus:outline-none focus:border-blue-400/50"
                      />
                      <input
                        type="text"
                        value={editDoneBy}
                        onChange={(e) => setEditDoneBy(e.target.value)}
                        placeholder="Done by"
                        className="sm:col-span-2 bg-dash-card2 border border-white/[0.1] rounded px-2.5 py-1.5 text-[12px] text-white placeholder-gray-600 focus:outline-none focus:border-blue-400/50"
                      />
                    </div>
                    <textarea
                      value={editAction}
                      onChange={(e) => setEditAction(e.target.value)}
                      rows={2}
                      className="w-full bg-dash-card2 border border-white/[0.1] rounded px-2.5 py-1.5 text-[12px] text-white resize-none focus:outline-none focus:border-blue-400/50"
                    />
                    {editError && <p className="text-[11px] text-red-400">{editError}</p>}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditSave(note.id)}
                        disabled={editSubmitting}
                        className="px-3 py-1 text-[11px] font-semibold rounded bg-[#FFC220] text-[#0A0F1C] hover:bg-[#FFD050] disabled:opacity-50 transition-colors"
                      >
                        {editSubmitting ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1 text-[11px] font-medium rounded border border-white/[0.1] text-gray-400 hover:text-white transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : deletingId === note.id ? (
                  /* ── Delete confirmation ── */
                  <div className="flex items-center gap-3">
                    <p className="text-[12px] text-gray-300 flex-1">Delete this note?</p>
                    <button
                      onClick={() => handleDelete(note.id)}
                      className="px-3 py-1 text-[11px] font-semibold rounded bg-red-600 text-white hover:bg-red-500 transition-colors"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setDeletingId(null)}
                      className="px-3 py-1 text-[11px] font-medium rounded border border-white/[0.1] text-gray-400 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  /* ── Note display ── */
                  <div className="flex gap-4 items-start group">
                    <div className="flex-shrink-0 font-mono text-[11px] text-gray-500 w-24 pt-0.5">
                      {note.date}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-[#C8D5E8] leading-relaxed">{note.action}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">— {note.doneBy}</p>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <button
                        onClick={() => openEdit(note)}
                        className="px-2 py-0.5 text-[10px] font-medium rounded border border-white/[0.1] text-gray-400 hover:text-white hover:border-white/20 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => { setDeletingId(note.id); setEditingId(null); }}
                        className="px-2 py-0.5 text-[10px] font-medium rounded border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
