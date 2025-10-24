'use server';

/**
 * @fileOverview Provides study recommendations and advice through an AI-driven 'study buddy'.
 *
 * - getStudyBuddyRecommendations - A function that generates tailored study recommendations.
 * - StudyBuddyInput - The input type for the getStudyBuddyRecommendations function.
 * - StudyBuddyOutput - The return type for the getStudyBuddyRecommendations function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { directGeminiCall } from '@/ai/direct-gemini';

const StudyBuddyInputSchema = z.object({
  query: z.string().describe('The user\'s question/problem text. Use LaTeX if desired.'),
  imageDataUri: z.string().optional().describe('Optional image (data URL) of the problem or notes to analyze.'),
});
export type StudyBuddyInput = z.infer<typeof StudyBuddyInputSchema>;

const StudyBuddyOutputSchema = z.object({
  answer: z.string().describe('A full step-by-step solution with LaTeX, alternative methods if relevant, definitions/theorems used, and prerequisites.'),
});
export type StudyBuddyOutput = z.infer<typeof StudyBuddyOutputSchema>;

export async function getStudyBuddyRecommendations(input: StudyBuddyInput): Promise<StudyBuddyOutput> {
  return studyBuddyRecommendationsFlow(input);
}

const studyBuddyPrompt = ai.definePrompt({
  name: 'studyBuddyPrompt',
  input: {schema: StudyBuddyInputSchema},
  output: {schema: StudyBuddyOutputSchema},
  prompt: `You are a rigorous, empathetic AI study buddy.

  Your task is to SOLVE the user's problem and return JSON matching this schema: { "answer": string } where "answer" contains:
  - Numbered step-by-step solution (use LaTeX: $$...$$ for display math, $...$ for inline math).
  - Alternative solution(s) when relevant.
  - Definitions/theorems used (name + statement).
  - Prerequisites the reader should know (bulleted list).
  - Consistent, self-contained notation.

  User Query (text): {{{query}}}

  {{#if imageDataUri}}
  Analyze this problem image:
  {{media url=imageDataUri}}
  {{/if}}

  If both text and image are present, prefer the image and use text as context. Return only valid JSON with an "answer" string.
  `,
});

const studyBuddyRecommendationsFlow = ai.defineFlow(
  {
    name: 'studyBuddyRecommendationsFlow',
    inputSchema: StudyBuddyInputSchema,
    outputSchema: StudyBuddyOutputSchema,
  },
  async input => {
    try {
      const {output} = await studyBuddyPrompt(input);
      return output!;
    } catch (e: any) {
      console.log('Genkit failed, trying direct Gemini API...', e?.message);
      
      // Provide a helpful fallback without trying another API call
      console.error('All AI services failed, providing manual guidance');
      const looksLikeMath = /\?|solve|prove|show|find|compute|evaluate|integral|derivative|equation|system|matrix|vector|limit|sum|series/i.test(input.query)
      
      if (looksLikeMath) {
        return {
          answer: `**AI temporarily unavailable - Manual approach for: "${input.query.slice(0, 100)}..."**

**Step-by-step approach:**
1. **Restate the problem clearly** - Write out what you're asked to find
2. **List known values** - Identify all given information
3. **Choose your method** - Select appropriate formulas/techniques:
   - For calculus: derivatives, integrals, limits
   - For algebra: solving equations, factoring
   - For linear algebra: matrix operations, systems
4. **Execute step-by-step** - Show all work with units
5. **Verify your answer** - Check reasonableness and units

**Alternative approaches:**
- Try graphing or visualization
- Work backwards from the answer format
- Break complex problems into simpler parts

**Note:** The AI service requires a valid Gemini API key with model access. Please check:
- Your API key at https://aistudio.google.com/app/apikey
- Regional availability (Gemini may not be available in all regions)
- Billing setup if using paid features`
        }
      } else {
        return {
          answer: `**AI Study Buddy temporarily unavailable**

For your question: "${input.query.slice(0, 100)}..."

**Manual study approach:**
- Break down the topic into key concepts
- Look up definitions of unfamiliar terms
- Find worked examples in your textbook
- Practice similar problems
- Ask specific questions to teachers/classmates

**Technical note:** The Gemini API requires proper setup. Please verify your API key and regional availability.`
        }
      }
    }
  }
);
