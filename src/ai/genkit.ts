import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

// Verify API key is available
if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY) {
  console.warn('WARNING: No GEMINI_API_KEY or GOOGLE_API_KEY found in environment');
}

export const ai = genkit({
  plugins: [googleAI({
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
  })],
  model: 'googleai/gemini-2.5-flash', // Using Gemini 2.5 Flash (1.5 is deprecated)
});
