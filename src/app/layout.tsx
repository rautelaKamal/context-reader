import type { Metadata } from 'next';
import { Inter, Source_Serif_4 } from 'next/font/google';
import './globals.css';

// The product film's type: Inter, heavy and tight, for everything said about
// the tool; Source Serif 4 for the passages themselves.
const inter = Inter({ variable: '--font-ui', subsets: ['latin'], display: 'swap' });
const serif = Source_Serif_4({
  variable: '--font-reading',
  subsets: ['latin'],
  style: ['normal', 'italic'],
  display: 'swap',
  // Only passages below the fold use it, so it shouldn't compete with the first paint.
  preload: false,
});

const TITLE = 'ContextReader: understand any hard sentence you read online';
const DESCRIPTION =
  'A free Chrome add-on. Select a sentence that confuses you and get what the writer actually means, in plain English.';

export const metadata: Metadata = {
  metadataBase: new URL('https://context-reader.vercel.app'),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: '/',
    siteName: 'ContextReader',
    type: 'website',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'ContextReader: understand any hard sentence you read online. A free Chrome add-on.' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${serif.variable}`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
