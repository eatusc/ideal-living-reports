'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { withBasePath } from '@/lib/basePath';

interface UploadBarProps {
  company: 'rpd-walmart' | 'elevate' | 'rpd-hd' | 'lustroware' | 'somarsh';
}

interface UploadResponse {
  summary?: string;
  sheetsMissing?: string[];
  weeksFound?: number;
  error?: string;
}

interface GoogleStatusResponse {
  connected?: boolean;
}

interface GoogleProcessResponse {
  ok?: boolean;
  processed?: boolean;
  requiresConfirmation?: boolean;
  company?: string;
  spreadsheetTitle?: string;
  expectedSheets?: string[];
  availableSheets?: string[];
  missingSheets?: string[];
  extraSheets?: string[];
  anomalies?: string[];
  summary?: string;
  weeksFound?: number;
  totalDataRows?: number;
  error?: string;
}

export default function UploadBar({ company }: UploadBarProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'warning' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [isDragActive, setIsDragActive] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleStatus, setGoogleStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [googleMessage, setGoogleMessage] = useState('');
  const [sheetUrl, setSheetUrl] = useState('');
  const [processingSheet, setProcessingSheet] = useState(false);
  const [processProgress, setProcessProgress] = useState(0);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [pendingAnomalies, setPendingAnomalies] = useState<{
    title: string;
    expectedSheets: string[];
    availableSheets: string[];
    missingSheets: string[];
    extraSheets: string[];
    anomalies: string[];
    canOverride: boolean;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadGoogleStatus() {
      setGoogleStatus('loading');
      try {
        const res = await fetch(withBasePath('/api/google/sheets/status'), { cache: 'no-store' });
        const data = (await res.json()) as GoogleStatusResponse;
        if (cancelled) return;
        if (res.ok) {
          setGoogleConnected(!!data.connected);
          setGoogleStatus('idle');
        } else {
          setGoogleStatus('error');
          setGoogleMessage('Failed to load Google connection status');
        }
      } catch {
        if (cancelled) return;
        setGoogleStatus('error');
        setGoogleMessage('Failed to load Google connection status');
      }
    }

    void loadGoogleStatus();
    return () => {
      cancelled = true;
    };
  }, []);

  function setFile(file: File | null) {
    setSelectedFile(file);
    setStatus('idle');
    setMessage('');
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setFile(file);
  }

  function handleDragOver(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  }

  function handleDragLeave(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  }

  function handleDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    const file = e.dataTransfer.files?.[0] ?? null;
    if (!file) return;
    setFile(file);
  }

  async function handleUpload() {
    if (!selectedFile) return;

    setStatus('uploading');
    setMessage('');

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const res = await fetch(withBasePath(`/api/upload/${company}`), {
        method: 'POST',
        body: formData,
      });

      let data: UploadResponse = {};
      try {
        data = await res.json();
      } catch {
        setStatus('error');
        setMessage(`Server error (${res.status}) — check Vercel logs`);
        return;
      }

      if (res.ok) {
        const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const summary = data.summary ?? '';
        const hasWarning = (data.sheetsMissing?.length ?? 0) > 0 || data.weeksFound === 0;

        if (hasWarning) {
          setStatus('warning');
          setMessage(`File saved but: ${summary}`);
        } else {
          setStatus('success');
          setMessage(`${summary} · ${today}`);
        }
        setSelectedFile(null);
        if (inputRef.current) inputRef.current.value = '';
        router.refresh();
      } else {
        setStatus('error');
        setMessage(data.error ?? 'Upload failed');
      }
    } catch {
      setStatus('error');
      setMessage('Network error — please try again');
    }
  }

  function handleReload() {
    router.refresh();
  }

  function connectGoogle() {
    const returnTo = window.location.pathname + window.location.search;
    window.location.href = withBasePath(`/api/google/oauth/start?returnTo=${encodeURIComponent(returnTo)}`);
  }

  async function disconnectGoogle() {
    setGoogleMessage('');
    try {
      const res = await fetch(withBasePath('/api/google/oauth/disconnect'), { method: 'POST' });
      if (!res.ok) {
        setGoogleMessage('Failed to disconnect Google');
        return;
      }
      setGoogleConnected(false);
      setPendingAnomalies(null);
      setGoogleMessage('Google disconnected');
    } catch {
      setGoogleMessage('Failed to disconnect Google');
    }
  }

  function startProgress() {
    setProcessProgress(5);
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    progressTimerRef.current = setInterval(() => {
      setProcessProgress((p) => (p >= 92 ? p : p + Math.max(1, Math.round((100 - p) / 12))));
    }, 220);
  }

  function stopProgress(finalValue = 100) {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    setProcessProgress(finalValue);
  }

  async function handleProcessSheet(confirmAnomalies = false) {
    if (!sheetUrl.trim()) return;
    setProcessingSheet(true);
    setGoogleMessage('');
    setPendingAnomalies(null);
    startProgress();

    try {
      const res = await fetch(withBasePath(`/api/google/sheets/process/${company}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheetUrl, confirmAnomalies }),
      });

      let data: GoogleProcessResponse = {};
      try {
        data = (await res.json()) as GoogleProcessResponse;
      } catch {
        const raw = await res.text().catch(() => '');
        setGoogleMessage(`Failed to process Google Sheet (HTTP ${res.status})${raw ? `: ${raw.slice(0, 180)}` : ''}`);
        stopProgress(0);
        return;
      }
      if (res.status === 409 && data.requiresConfirmation) {
        setPendingAnomalies({
          title: data.spreadsheetTitle ?? '(untitled)',
          expectedSheets: data.expectedSheets ?? [],
          availableSheets: data.availableSheets ?? [],
          missingSheets: data.missingSheets ?? [],
          extraSheets: data.extraSheets ?? [],
          anomalies: data.anomalies ?? ['Detected mismatch with expected report format.'],
          canOverride: true,
        });
        stopProgress(0);
        setGoogleMessage('Anomalies detected. Review and confirm before processing.');
        return;
      }

      if (res.status === 422) {
        setPendingAnomalies({
          title: data.spreadsheetTitle ?? '(untitled)',
          expectedSheets: data.expectedSheets ?? [],
          availableSheets: data.availableSheets ?? [],
          missingSheets: data.missingSheets ?? [],
          extraSheets: data.extraSheets ?? [],
          anomalies: data.anomalies ?? ['Critical data anomaly detected; processing blocked.'],
          canOverride: false,
        });
        stopProgress(0);
        setGoogleMessage('Critical data anomaly detected. Processing was blocked.');
        return;
      }

      if (!res.ok) {
        setGoogleMessage(data.error ?? 'Failed to read Google Sheet');
        if (res.status === 401) setGoogleConnected(false);
        stopProgress(0);
        return;
      }

      setGoogleConnected(true);
      stopProgress(100);
      const processedTitle = data.spreadsheetTitle ?? '(untitled)';
      const processedSheets = data.availableSheets?.length ?? 0;
      const summary = data.summary ?? '';
      setGoogleMessage(`Processed: ${processedTitle} · ${processedSheets} tab(s) · ${summary}`);
      handleReload();
    } catch {
      stopProgress(0);
      setGoogleMessage('Failed to process Google Sheet');
    } finally {
      setProcessingSheet(false);
    }
  }

  useEffect(() => {
    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, []);

  const showReload = status === 'success' || status === 'warning';
  const fileAccept = company === 'somarsh' ? '.xlsx,.xls,.csv' : '.xlsx,.xls';
  const chooseLabel = company === 'somarsh'
    ? (selectedFile ? selectedFile.name : 'Choose or drop Excel/BusinessReport CSV…')
    : (selectedFile ? selectedFile.name : 'Choose or drop Excel file…');

  return (
    <div className="mb-6 bg-dash-card border border-white/[0.08] rounded-lg px-4 py-3">
      <div className="text-[10px] font-bold uppercase tracking-[1px] text-gray-500 mb-2">
        Data Source
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label
          className={`flex items-center gap-2 cursor-pointer rounded border px-2 py-1 transition-colors ${
            isDragActive
              ? 'border-[#FFC220]/70 bg-[#FFC220]/10'
              : 'border-transparent'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            ref={inputRef}
            type="file"
            accept={fileAccept}
            onChange={handleFileChange}
            className="hidden"
          />
          <span className="px-3 py-1.5 text-[12px] font-medium rounded bg-dash-card2 border border-white/[0.1] text-gray-300 hover:border-white/20 hover:text-white transition-colors">
            {chooseLabel}
          </span>
        </label>

        {selectedFile && (
          <button
            onClick={handleUpload}
            disabled={status === 'uploading'}
            className="px-3 py-1.5 text-[12px] font-semibold rounded bg-[#FFC220] text-[#0A0F1C] hover:bg-[#FFD050] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {status === 'uploading' ? 'Uploading…' : 'Upload'}
          </button>
        )}

        <span className="text-[10px] uppercase tracking-wide text-gray-600">or</span>

        {!googleConnected ? (
          <button
            type="button"
            onClick={connectGoogle}
            disabled={googleStatus === 'loading'}
            className="px-3 py-1.5 text-[12px] font-semibold rounded bg-[#0071CE]/20 border border-[#0071CE]/40 text-blue-300 hover:bg-[#0071CE]/30 disabled:opacity-50 transition-colors"
          >
            {googleStatus === 'loading' ? 'Checking Google…' : 'Connect Google'}
          </button>
        ) : (
          <>
            <span className="text-[11px] text-green-400 font-mono">✓ Google connected</span>
            <button
              type="button"
              onClick={disconnectGoogle}
              className="px-3 py-1.5 text-[12px] font-semibold rounded bg-red-500/10 border border-red-400/40 text-red-300 hover:bg-red-500/20 transition-colors"
            >
              Disconnect
            </button>
          </>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={sheetUrl}
          onChange={(e) => setSheetUrl(e.target.value)}
          placeholder="Paste Google Sheet URL to process into this report…"
          className="min-w-[280px] flex-1 bg-dash-card2 border border-white/[0.1] rounded px-3 py-1.5 text-[12px] text-white placeholder:text-gray-500 outline-none focus:border-blue-400/50"
        />
        <button
          type="button"
          onClick={() => handleProcessSheet(false)}
          disabled={processingSheet || !sheetUrl.trim()}
          className="px-3 py-1.5 text-[12px] font-bold rounded bg-violet-500/35 border border-violet-300/70 text-white hover:bg-violet-500/45 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {processingSheet ? 'Processing…' : 'Process Sheet'}
        </button>
      </div>

      {processingSheet && (
        <div className="mt-2">
          <div className="h-2 w-full overflow-hidden rounded bg-white/[0.08]">
            <div
              className="h-full bg-violet-400 transition-all duration-200"
              style={{ width: `${processProgress}%` }}
            />
          </div>
          <div className="mt-1 text-[10px] text-violet-200 font-mono">
            Processing spreadsheet data for `{company}`… {processProgress}%
          </div>
        </div>
      )}

      {status === 'success' && <div className="mt-2 text-[11px] text-green-400 font-mono">✓ {message}</div>}
      {status === 'warning' && <div className="mt-2 text-[11px] text-amber-400 font-mono">⚠ {message}</div>}
      {status === 'error' && <div className="mt-2 text-[11px] text-red-400 font-mono">✗ {message}</div>}

      {googleMessage && (
        <div className={`mt-2 text-[11px] font-mono ${googleMessage.startsWith('Processed:') ? 'text-green-300' : 'text-amber-300'}`}>
          {googleMessage.startsWith('Processed:') ? '✓' : '⚠'} {googleMessage}
        </div>
      )}

      {pendingAnomalies && (
        <div className="mt-3 rounded border border-white/[0.08] bg-dash-card2 p-3">
          <div className="text-[11px] text-amber-200 mb-2 font-mono">
            Anomaly Check: {pendingAnomalies.title}
          </div>
          <ul className="list-disc ml-4 space-y-1 text-[11px] text-amber-100 font-mono">
            {pendingAnomalies.anomalies.map((a, idx) => (
              <li key={`anomaly-${idx}`}>{a}</li>
            ))}
          </ul>
          <div className="mt-2 text-[10px] text-gray-400 font-mono">
            Expected tabs: {pendingAnomalies.expectedSheets.join(' | ') || '—'}
          </div>
          <div className="mt-1 text-[10px] text-gray-500 font-mono">
            Found tabs: {pendingAnomalies.availableSheets.join(' | ') || '—'}
          </div>
          {pendingAnomalies.canOverride ? (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => handleProcessSheet(true)}
                disabled={processingSheet}
                className="px-3 py-1.5 text-[12px] font-bold rounded bg-amber-500/25 border border-amber-300/60 text-amber-100 hover:bg-amber-500/35 disabled:opacity-50 transition-colors"
              >
                Process Anyway
              </button>
            </div>
          ) : (
            <div className="mt-3 text-[11px] font-mono text-red-300">
              Processing is blocked. Fix the source sheet values and retry.
            </div>
          )}
        </div>
      )}

      {showReload && (
        <div className="mt-2">
          <button
            onClick={handleReload}
            className="px-3 py-1.5 text-[12px] font-semibold rounded bg-[#0071CE]/20 border border-[#0071CE]/40 text-blue-300 hover:bg-[#0071CE]/30 transition-colors"
          >
            Reload Report
          </button>
        </div>
      )}
    </div>
  );
}
