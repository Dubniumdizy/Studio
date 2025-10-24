'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';

export async function directGeminiCall(query: string, imageDataUri?: string): Promise<string> {
  try {
    const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '';
    console.log('API Key found:', apiKey ? `${apiKey.substring(0, 10)}...` : 'NONE');
    console.log('Available env vars:', Object.keys(process.env).filter(k => k.includes('GOOGLE') || k.includes('GEMINI')));
    
    if (!apiKey) {
      throw new Error('No API key found. Check GOOGLE_GENAI_API_KEY, GOOGLE_API_KEY, or GEMINI_API_KEY environment variables.');
    }
    
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    const parts: any[] = [query];
    if (imageDataUri) {
      const [mimeString, data] = imageDataUri.split(',');
      const mimeType = mimeString.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*/) || ['', 'image/jpeg'];
      parts.push({
        inlineData: {
          data,
          mimeType: mimeType[1] || 'image/jpeg'
        }
      });
    }

    const result = await model.generateContent(parts);
    const response = await result.response;
    return response.text() || 'No response generated';
  } catch (error: any) {
    console.error('Direct Gemini API error:', error);
    return `Error: ${error.message || 'Unknown error'} - Check your GOOGLE_GENAI_API_KEY environment variable`;
  }
}