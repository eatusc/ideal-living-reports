export const dynamic = 'force-dynamic';

import Link from 'next/link';
import BrandOpsBoard from '@/components/BrandOpsBoard';
import { getBrandOpsData } from '@/lib/brandOps';
import NotesSection from '@/components/NotesSection';
import { readNotes, type Note } from '@/lib/notes';

export default async function BrandOpsPage() {
  const { goals, signals, awareness } = await getBrandOpsData();
  let notes: Note[] = [];
  try {
    notes = await readNotes('brand-ops');
  } catch {
    // ignore notes read failures for page resiliency
  }
  const generatedAt = new Date().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <main className="report-redesign min-h-screen bg-slate-50 px-4 sm:px-6 py-10">
      <div className="max-w-[1300px] mx-auto">
        <div className="flex gap-3 mb-4 text-[11px] font-mono">
          <span className="text-gray-600">Reports:</span>
          <Link href="/" className="text-blue-300 hover:text-blue-200 transition-colors">Home</Link>
          <Link href="/aceteam" className="text-blue-300 hover:text-blue-200 transition-colors">/aceteam</Link>
          <span className="text-[#FFC220] font-semibold">/brand-ops</span>
          <Link href="/elevate" className="text-blue-300 hover:text-blue-200 transition-colors">/elevate</Link>
          <Link href="/rpd-walmart" className="text-blue-300 hover:text-blue-200 transition-colors">/rpd-walmart</Link>
          <Link href="/rpd-hd" className="text-blue-300 hover:text-blue-200 transition-colors">/rpd-hd</Link>
          <Link href="/lustroware" className="text-blue-300 hover:text-blue-200 transition-colors">/lustroware</Link>
          <Link href="/somarsh" className="text-blue-300 hover:text-blue-200 transition-colors">/somarsh</Link>
        </div>

        <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8 pb-6 border-b border-white/[0.08]">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <div className="w-8 h-8 rounded-full bg-[#FFC220] flex items-center justify-center text-[#0A0F1C] font-bold text-lg leading-none select-none">★</div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Cross-Brand Action Hub</h1>
            </div>
            <p className="text-sm text-gray-400">Potential issues, recommended actions, and ACoS goal controls across all brands.</p>
          </div>
          <div className="text-right font-mono text-[12px] text-gray-400">
            <div className="text-[14px] font-semibold text-[#E8EDF5] mb-0.5">Informational Review Board</div>
            <div>Generated: {generatedAt}</div>
            <div>{signals.length} signals</div>
          </div>
        </header>

        <BrandOpsBoard initialGoals={goals} signals={signals} awareness={awareness} />
        <NotesSection company="brand-ops" initialNotes={notes} />
      </div>
    </main>
  );
}
