export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div className="w-10 h-10 rounded-full bg-[#FFC220] flex items-center justify-center text-[#0A0F1C] font-bold text-xl leading-none select-none mx-auto mb-6">
          ★
        </div>
        <h1 className="text-xl font-bold text-white mb-2">Ideal Living Reports</h1>
        <p className="text-[14px] text-gray-400">
          Enter the URL of the report you are looking for.
        </p>
        <div className="mt-6 text-[12px] font-mono space-y-2">
          <a href="/rpd-walmart" className="block text-blue-400 hover:text-blue-300 transition-colors">/rpd-walmart</a>
          <a href="/rpd-hd" className="block text-blue-400 hover:text-blue-300 transition-colors">/rpd-hd</a>
        </div>
      </div>
    </main>
  );
}
