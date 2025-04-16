import { NextResponse } from 'next/server';
import { getSession } from '@auth0/nextjs-auth0';
import { getUserAnnotations, getAnnotationsByUrl } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session?.user?.sub) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    const annotations = url
      ? await getAnnotationsByUrl(session.user.sub, url)
      : await getUserAnnotations(session.user.sub);

    return NextResponse.json(annotations);
  } catch (error) {
    console.error('Error fetching annotations:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
