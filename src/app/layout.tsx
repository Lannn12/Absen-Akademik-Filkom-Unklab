import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Smar — Sistem Absensi Bimbingan Akademik',
  description:
    'Sistem pencatatan kehadiran bimbingan akademik per tingkat mahasiswa dengan barcode scanner, analisis kepatuhan, dan early warning system.',
  keywords: [
    'absensi',
    'bimbingan akademik',
    'kehadiran mahasiswa',
    'barcode scanner',
    'BEM',
  ],
  authors: [{ name: 'BEM Fakultas' }],
  openGraph: {
    title: 'Smart Academic Guidance',
    description: 'Sistem Absensi Bimbingan Akademik per Tingkat',
    type: 'website',
  },
};

import { ToastProvider } from './components/ui/Toast';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={inter.variable}>
      <body className="min-h-screen antialiased">
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
