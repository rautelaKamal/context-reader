import type { Metadata } from 'next';
import { Literata, IBM_Plex_Sans } from 'next/font/google';
import './globals.css';

// Literata was drawn for reading books on screens, which is the whole subject
// of this page. Plex Sans carries the interface without competing with it.
const literata = Literata({
  variable: '--font-reading',
  subsets: ['latin'],
  display: 'swap',
});

const plex = IBM_Plex_Sans({
  variable: '--font-ui',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ContextReader — what the writer actually means',
  description:
    'Select a passage that lost you. ContextReader reads it in context and tells you what the writer is actually saying.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${literata.variable} ${plex.variable}`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
