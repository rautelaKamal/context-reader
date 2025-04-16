import { NextResponse } from 'next/server';
import { getTranslation } from '@/lib/ai';
import { corsHeaders } from '@/lib/cors';

export const runtime = 'edge';

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: Request) {
  try {
    const { text } = await request.json();

    if (!text) {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    console.log('Translating text:', text);
    const translation = await getTranslation(text);
    console.log('Got translation:', translation);

    return NextResponse.json(
      { translation },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('Error in translate API:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Error stack:', error.stack);
      return NextResponse.json(
        { error: error.message },
        { status: 500, headers: corsHeaders }
      );
    }
    return NextResponse.json(
      { error: 'Failed to get translation' },
      { status: 500, headers: corsHeaders }
    );
  }
}
