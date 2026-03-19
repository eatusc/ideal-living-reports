import type { Metadata } from 'next';
import { DM_Sans, DM_Mono } from 'next/font/google';
import './globals.css';

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '700'],
  variable: '--font-dm-sans',
  display: 'swap',
});

const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-dm-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Ideal Living — Walmart Weekly Performance Report',
  description: 'Walmart Advertising & Sales weekly performance dashboard for Ideal Living',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${dmSans.variable} ${dmMono.variable}`}>
      <head>
        {/* Suppress MetaMask extension injection errors */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var origConsoleError = console.error;
                console.error = function() {
                  var msg = arguments[0];
                  if (typeof msg === 'string' && msg.indexOf('MetaMask') !== -1) return;
                  return origConsoleError.apply(console, arguments);
                };
              })();
            `,
          }}
        />
      </head>
      <body className="font-sans bg-dash-dark text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
