import Link from 'next/link';

export default function AceTeamPage() {
  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
      <div className="text-center max-w-md rounded-xl border border-slate-200 bg-white px-8 py-10 shadow-sm">
        <div className="w-10 h-10 rounded-full bg-[#FFC220] flex items-center justify-center text-[#0A0F1C] font-bold text-xl leading-none select-none mx-auto mb-6">
          ★
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">BE Media Global Reports</h1>
        <p className="text-[14px] text-slate-600">
          Enter the URL of the report you are looking for.
        </p>
        <div className="mt-6 text-[12px] font-mono space-y-2">
          <Link href="/" className="block text-blue-700 hover:text-blue-900 transition-colors">Home</Link>
          <Link href="/brand-ops" className="block text-blue-700 hover:text-blue-900 transition-colors">/brand-ops</Link>
          <Link href="/rpd-walmart" className="block text-blue-700 hover:text-blue-900 transition-colors">/rpd-walmart</Link>
          <Link href="/rpd-hd" className="block text-blue-700 hover:text-blue-900 transition-colors">/rpd-hd</Link>
          <Link href="/elevate" className="block text-blue-700 hover:text-blue-900 transition-colors">/elevate</Link>
          <Link href="/lustroware" className="block text-blue-700 hover:text-blue-900 transition-colors">/lustroware</Link>
          <Link href="/somarsh" className="block text-blue-700 hover:text-blue-900 transition-colors">/somarsh</Link>
        </div>
      </div>
    </main>
  );
}
