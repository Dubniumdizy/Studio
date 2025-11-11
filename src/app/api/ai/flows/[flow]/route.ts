import 'server-only';

export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { ai } from '@/ai/genkit';
import { getStudyBuddyRecommendations } from '@/ai/flows/study-buddy-recommendations';
import { recommendResources } from '@/ai/flows/resource-recommendation';
import { generateInspiration } from '@/ai/flows/inspiration-generator';
import { analyzeExam } from '@/ai/flows/exam-analyzer';
import { analyzeBook } from '@/ai/flows/book-analyzer';
import { formulaSheetSuggestions } from '@/ai/flows/formula-sheet-suggestions';

function json(data: any, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

export async function POST(req: NextRequest, context: { params: { flow: string } }) {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) {
    return json({ error: 'GEMINI_API_KEY or GOOGLE_API_KEY missing on server' }, { status: 500 });
  }

  const { flow } = context.params;
  let body: any = null;
  try {
    body = await req.json();
  } catch (e) {
    return json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    switch (flow) {
      case 'study-buddy': {
        const out = await getStudyBuddyRecommendations(body);
        return json(out);
      }
      case 'resources': {
        const out = await recommendResources(body);
        return json(out);
      }
      case 'inspiration': {
        const out = await generateInspiration(body);
        return json(out);
      }
      case 'exam-analyzer': {
        const out = await analyzeExam(body);
        return json(out);
      }
      case 'book-analyzer': {
        const out = await analyzeBook(body);
        return json(out);
      }
      case 'formula-sheet': {
        const out = await formulaSheetSuggestions(body);
        return json(out);
      }
      default:
        return json({ error: `Unknown flow: ${flow}` }, { status: 404 });
    }
  } catch (err: any) {
    return json({ error: err?.message || 'Generation failed' }, { status: 500 });
  }
}