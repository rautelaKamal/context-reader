import { NextResponse } from 'next/server';
import { getExplanation } from '@/lib/ai';
import { corsHeaders } from '@/lib/cors';

export const runtime = 'edge';

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: Request) {
  try {
    // Check API key first
    if (!process.env.HUGGING_FACE_API_KEY) {
      console.error('HUGGING_FACE_API_KEY is not set');
      return NextResponse.json(
        { error: 'API configuration error. Please contact support.' },
        { status: 500, headers: corsHeaders }
      );
    }

    const { text } = await request.json();

    if (!text) {
      console.error('Text is required but was not provided');
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    if (text.length > 1000) {
      console.error('Text is too long:', text.length);
      return NextResponse.json(
        { error: 'Text is too long. Please select a shorter passage.' },
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
      
      // Handle specific error types
      if (error.message.includes('HUGGING_FACE_API_KEY')) {
        return NextResponse.json(
          { error: 'API configuration error. Please contact support.' },
          { status: 500, headers: corsHeaders }
        );
      } else if (error.message.includes('rate limit')) {
        return NextResponse.json(
          { error: 'Too many requests. Please try again later.' },
          { status: 429, headers: corsHeaders }
        );
      }
      
      return NextResponse.json(
        { error: 'Failed to get explanation. Please try again.' },
        { status: 500, headers: corsHeaders }
      );
    }
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500, headers: corsHeaders }
    );
  }
}
