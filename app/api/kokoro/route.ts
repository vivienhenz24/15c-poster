import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    // Call Gradio API for Kokoro TTS
    // Try multiple possible endpoints
    const baseUrl = 'https://hexgrad-kokoro-tts.hf.space';
    const endpoints = [
      '/api/predict',
      '/run/predict',
      '/api/v1/predict',
    ];

    let result;
    let lastError;

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`${baseUrl}${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            data: [text],
            fn_index: 0,
          }),
        });

        if (response.ok) {
          result = await response.json();
          break;
        } else if (response.status !== 404) {
          // If it's not 404, it might be the right endpoint but with wrong format
          const errorText = await response.text();
          lastError = `Status ${response.status}: ${errorText}`;
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : 'Unknown error';
        continue;
      }
    }

    if (!result) {
      throw new Error(
        `Gradio API endpoints not accessible. This space may require the Gradio client library. ` +
        `Last error: ${lastError || 'All endpoints returned 404'}. ` +
        `You may need to use @gradio/client package or check the space's API documentation.`
      );
    }
    
    // Gradio API typically returns { data: [...] } format
    // The audio file URL or base64 data should be in result.data
    const audioData = result.data?.[0] || result.data;

    return NextResponse.json({ 
      audio: audioData,
      success: true 
    });

  } catch (error) {
    console.error('Kokoro TTS API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate audio' },
      { status: 500 }
    );
  }
}

