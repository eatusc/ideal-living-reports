import Link from 'next/link';

export default function AceTeamPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center max-w-md rounded-[28px] border border-white/70 bg-white/75 px-8 py-10 shadow-[0_28px_70px_rgba(115,145,173,0.22)] backdrop-blur">
        <div className="w-10 h-10 rounded-full bg-[#FFC220] flex items-center justify-center text-[#0A0F1C] font-bold text-xl leading-none select-none mx-auto mb-6">
          ★
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">BE Media Global Reports</h1>
        <p className="text-[14px] text-slate-600">
          Enter the URL of the report you are looking for.
        </p>
        <div className="mt-6 text-[12px] font-mono space-y-2">
          <Link href="/elevate" className="block text-sky-700 hover:text-sky-900 transition-colors">/elevate</Link>
          <Link href="/lustroware" className="block text-sky-700 hover:text-sky-900 transition-colors">/lustroware</Link>
          <Link href="/somarsh" className="block text-sky-700 hover:text-sky-900 transition-colors">/somarsh</Link>
        </div>
      </div>
    </main>
  );
}
