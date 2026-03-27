'use client';

import { useState, useRef } from 'react';
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

export default function UploadBar({ company }: UploadBarProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'warning' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [isDragActive, setIsDragActive] = useState(false);

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

  const showReload = status === 'success' || status === 'warning';

  return (
    <div className="mb-6 bg-dash-card border border-white/[0.08] rounded-lg px-4 py-3 flex flex-wrap items-center gap-3">
      <div className="text-[10px] font-bold uppercase tracking-[1px] text-gray-500 mr-1">
        Data
      </div>

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
          accept=".xlsx,.xls"
          onChange={handleFileChange}
          className="hidden"
        />
        <span className="px-3 py-1.5 text-[12px] font-medium rounded bg-dash-card2 border border-white/[0.1] text-gray-300 hover:border-white/20 hover:text-white transition-colors">
          {selectedFile ? selectedFile.name : 'Choose or drop Excel file…'}
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

      {status === 'success' && (
        <span className="text-[11px] text-green-400 font-mono">✓ {message}</span>
      )}

      {status === 'warning' && (
        <span className="text-[11px] text-amber-400 font-mono">⚠ {message}</span>
      )}

      {showReload && (
        <button
          onClick={handleReload}
          className="px-3 py-1.5 text-[12px] font-semibold rounded bg-[#0071CE]/20 border border-[#0071CE]/40 text-blue-300 hover:bg-[#0071CE]/30 transition-colors"
        >
          Reload Report
        </button>
      )}

      {status === 'error' && (
        <span className="text-[11px] text-red-400 font-mono">✗ {message}</span>
      )}
    </div>
  );
}
