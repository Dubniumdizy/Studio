// src/ai/flows/resource-recommendation.ts
'use server';

/**
 * @fileOverview A flow for recommending external resources based on subject material.
 *
 * - recommendResources - A function that recommends resources.
 * - RecommendResourcesInput - The input type for the recommendResources function.
 * - RecommendResourcesOutput - The return type for the recommendResources function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const RecommendResourcesInputSchema = z.object({
  subjectMaterial: z
    .string()
    .describe('The subject material for which resources are needed.'),
});
export type RecommendResourcesInput = z.infer<typeof RecommendResourcesInputSchema>;

const RecommendResourcesOutputSchema = z.object({
  recommendedResources: z
    .array(z.string())
    .describe('A list of recommended external resources, like YouTube channels, websites, or books. Do not include URLs.'),
  reasoning: z
    .string()
    .describe('The AI reasoning behind the recommended resources.'),
});
export type RecommendResourcesOutput = z.infer<typeof RecommendResourcesOutputSchema>;

export async function recommendResources(
  input: RecommendResourcesInput
): Promise<RecommendResourcesOutput> {
  return recommendResourcesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'resourceRecommendationPrompt',
  input: {schema: RecommendResourcesInputSchema},
  output: {schema: RecommendResourcesOutputSchema},
  prompt: `You are an AI assistant designed to recommend external resources for students. Based on the subject material, provide a list of helpful resources like specific YouTube channels, educational websites, or online textbooks.

**IMPORTANT**: Do NOT provide URLs. Instead, provide the name of the resource so the user can search for it themselves (e.g., "3Blue1Brown on YouTube", "Paul's Online Math Notes website").

Also, provide a brief reasoning for why you are recommending these resources.

Subject Material: {{{subjectMaterial}}}
`,
});

const recommendResourcesFlow = ai.defineFlow(
  {
    name: 'recommendResourcesFlow',
    inputSchema: RecommendResourcesInputSchema,
    outputSchema: RecommendResourcesOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
