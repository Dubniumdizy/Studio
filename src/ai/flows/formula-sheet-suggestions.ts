'use server';

/**
 * @fileOverview This file defines a Genkit flow for providing AI-driven suggestions for simplification and relevant content based on the formulas input by the user in the formula sheet tool.
 *
 * - formulaSheetSuggestions - A function that handles the formula sheet suggestions process.
 * - FormulaSheetSuggestionsInput - The input type for the formulaSheetSuggestions function.
 * - FormulaSheetSuggestionsOutput - The return type for the formulaSheetSuggestions function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const FormulaSheetSuggestionsInputSchema = z.object({
  formula: z.string().describe('The formula for which to provide suggestions.'),
  context: z.string().optional().describe('Additional context or notes related to the formula.'),
});
export type FormulaSheetSuggestionsInput = z.infer<typeof FormulaSheetSuggestionsInputSchema>;

const FormulaSheetSuggestionsOutputSchema = z.object({
  simplificationSuggestions: z.array(z.string()).describe('AI-driven suggestions for simplifying the formula.'),
  relevantContent: z.array(z.string()).describe('Relevant content or related formulas.'),
});
export type FormulaSheetSuggestionsOutput = z.infer<typeof FormulaSheetSuggestionsOutputSchema>;

export async function formulaSheetSuggestions(input: FormulaSheetSuggestionsInput): Promise<FormulaSheetSuggestionsOutput> {
  return formulaSheetSuggestionsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'formulaSheetSuggestionsPrompt',
  input: {schema: FormulaSheetSuggestionsInputSchema},
  output: {schema: FormulaSheetSuggestionsOutputSchema},
  prompt: `You are an AI assistant designed to provide suggestions for simplifying mathematical formulas and provide relevant content related to the formula.

  Formula: {{{formula}}}
  Context: {{{context}}}

  Please provide simplification suggestions and relevant content. Return the response as a JSON object.

  Make sure the JSON is valid and parsable.
  `,
  config: {
    safetySettings: [
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_ONLY_HIGH',
      },
            {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: 'BLOCK_ONLY_HIGH',
      },
            {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'BLOCK_ONLY_HIGH',
      },
            {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        threshold: 'BLOCK_ONLY_HIGH',
      },
    ],
  },
});

const formulaSheetSuggestionsFlow = ai.defineFlow(
  {
    name: 'formulaSheetSuggestionsFlow',
    inputSchema: FormulaSheetSuggestionsInputSchema,
    outputSchema: FormulaSheetSuggestionsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
