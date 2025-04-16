import { NextResponse } from 'next/server';
import { getExplanation } from '@/lib/ai';
import { corsHeaders } from '@/lib/cors';

export const runtime = 'edge';

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: Request) {
  try {
    const { text } = await request.json();

    if (!text) {
      console.error('Text is required but was not provided');
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    console.log('Explaining text:', text);
    const explanation = await getExplanation(text);
    console.log('Got explanation:', explanation);

    return NextResponse.json(
      { explanation },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('Error in explain API:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Error stack:', error.stack);
      return NextResponse.json(
        { error: error.message },
        { status: 500, headers: corsHeaders }
      );
    }
    return NextResponse.json(
      { error: 'Failed to get explanation' },
      { status: 500, headers: corsHeaders }
    );
  }
}
