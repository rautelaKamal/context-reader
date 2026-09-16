import { NextResponse } from 'next/server';

/**
 * Short, sayable, printable. The store URL carries a 32-character id, which is
 * no use on a slide, in a QR code, or read out loud.
 *
 * Route files may only export the handlers and Next's own config fields, so
 * the URL stays local rather than being exported from here.
 */
export function GET() {
  return NextResponse.redirect(
    'https://chromewebstore.google.com/detail/jncoindjikmapfahhnljenbplfboglhf',
    308,
  );
}
