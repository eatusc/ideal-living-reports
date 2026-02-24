'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function PinForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/rpd-walmart';

  const [digits, setDigits] = useState(['', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const refs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  useEffect(() => {
    refs[0].current?.focus();
  }, []);

  function handleChange(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    setError('');

    if (digit && index < 3) {
      refs[index + 1].current?.focus();
    }

    // Auto-submit when all 4 digits filled
    if (digit && index === 3) {
      const pin = [...next.slice(0, 3), digit].join('');
      if (pin.length === 4) submit(pin);
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      refs[index - 1].current?.focus();
    }
  }

  async function submit(pin: string) {
    setLoading(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, next }),
      });
      const data = await res.json();
      if (res.ok) {
        router.push(data.redirect);
      } else {
        setError('Incorrect PIN. Please try again.');
        setDigits(['', '', '', '']);
        refs[0].current?.focus();
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const pin = digits.join('');
    if (pin.length === 4) submit(pin);
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-xs">
        <div className="flex items-center gap-2.5 justify-center mb-8">
          <div className="w-8 h-8 rounded-full bg-[#FFC220] flex items-center justify-center text-[#0A0F1C] font-bold text-lg leading-none select-none">
            ★
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Ideal Living</h1>
        </div>

        <div className="bg-dash-card border border-white/[0.08] rounded-xl p-8">
          <p className="text-[13px] text-gray-400 text-center mb-6">
            Enter your 4-digit PIN to access reports
          </p>

          <form onSubmit={handleSubmit}>
            <div className="flex justify-center gap-3 mb-6">
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={refs[i]}
                  type="password"
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  onChange={(e) => handleChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  className="w-12 h-14 text-center text-xl font-mono font-bold bg-dash-card2 border border-white/[0.12] rounded-lg text-white focus:outline-none focus:border-[#FFC220]/60 focus:bg-[#FFC220]/5 transition-colors caret-transparent"
                  disabled={loading}
                />
              ))}
            </div>

            {error && (
              <p className="text-[12px] text-red-400 text-center mb-4">{error}</p>
            )}

            <button
              type="submit"
              disabled={digits.join('').length < 4 || loading}
              className="w-full py-2.5 rounded-lg bg-[#FFC220] text-[#0A0F1C] font-bold text-[13px] tracking-wide disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#FFD050] transition-colors"
            >
              {loading ? 'Verifying…' : 'Unlock'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

export default function PinPage() {
  return (
    <Suspense>
      <PinForm />
    </Suspense>
  );
}
