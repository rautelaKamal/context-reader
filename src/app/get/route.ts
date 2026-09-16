import { NextResponse } from 'next/server';

/** Short, sayable, printable. The store URL carries a 32-character id. */
export const STORE_URL = 'https://chromewebstore.google.com/detail/jncoindjikmapfahhnljenbplfboglhf';

export function GET() {
  return NextResponse.redirect(STORE_URL, 308);
}
