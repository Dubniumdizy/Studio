'use server';

/**
 * @fileOverview An AI agent that generates inspiration related to a subject of study based on uploaded course materials.
 *
 * - generateInspiration - A function that generates inspiration for a given subject.
 * - InspirationInput - The input type for the generateInspiration function.
 * - InspirationOutput - The return type for the generateInspiration function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const InspirationInputSchema = z.object({
  subject: z.string().describe('The subject of study.'),
  courseMaterials: z
    .string()
    .describe(
      'Course materials as a single string, including textbooks, exams, and practice papers.'
    ),
});
export type InspirationInput = z.infer<typeof InspirationInputSchema>;

const InspirationOutputSchema = z.object({
  bigPicture: z.string().describe('A detailed, intuitive explanation of the subject\'s core principles and significance.'),
  realWorldApplications: z.array(z.string()).describe('A list of 3-5 in-depth examples of real-world applications, explaining the "how".'),
  funFact: z.string().describe('An interesting and detailed historical fact or story about a breakthrough in the subject.'),
  diyProject: z.string().describe('A detailed, hands-on project idea or thought experiment for the user to try.'),
});
export type InspirationOutput = z.infer<typeof InspirationOutputSchema>;

export async function generateInspiration(
  input: InspirationInput
): Promise<InspirationOutput> {
  return generateInspirationFlow(input);
}

const prompt = ai.definePrompt({
  name: 'inspirationPrompt',
  input: {schema: InspirationInputSchema},
  output: {schema: InspirationOutputSchema},
  prompt: `You are a passionate and knowledgeable subject matter expert. Your goal is to ignite a student's curiosity by providing deep, intuitive, and technically rich explanations. Your audience is intelligent, curious, and not afraid of technical terminology. Generate detailed and inspiring content based on the provided subject and course materials.

  Break down the inspiration into the following distinct categories:
  1.  **The Big Picture**: Provide a detailed and intuitive explanation of the subject's core principles and its significance in the broader scientific or academic landscape. Use accurate terminology to explain why this subject is fundamental and what profound questions it helps us answer. Connect it to modern research frontiers or challenging open problems in the field.
  2.  **Deep Dive into Applications**: Present 3-5 real-world applications. For each, don't just name the application; explain *how* a specific concept from the subject is instrumental. For example, instead of just "GPS," explain how General Relativity's principles of time dilation are crucial for GPS accuracy.
  3.  **A Nugget of History**: Share an interesting historical fact or the story behind a major breakthrough. This could involve a key figure, a famous prize (like the Nobel Prize or Fields Medal), or the intellectual struggle that led to a discovery. Explain the significance of the event.
  4.  **Hands-On Exploration**: Describe a DIY project or thought experiment that allows a student to get a hands-on feel for the subject. Explain the setup and what key principles they will be observing or applying. Make it something a curious student could actually attempt.

  Subject: {{{subject}}}
  Course Materials: {{{courseMaterials}}}
  `,
});

const generateInspirationFlow = ai.defineFlow(
  {
    name: 'generateInspirationFlow',
    inputSchema: InspirationInputSchema,
    outputSchema: InspirationOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
