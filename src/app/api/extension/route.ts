import { NextResponse } from 'next/server';

/**
 * The zip is a static asset in public/, so redirect rather than reading it off
 * disk: the previous readFileSync depended on the filesystem layout surviving
 * the serverless bundle, which it does not reliably do.
 */
export function GET(request: Request) {
  return NextResponse.redirect(new URL('/extension.zip', request.url), 308);
}
