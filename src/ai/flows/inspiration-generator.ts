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
  knownUnderstanding: z.string().describe('What the student already understands about the topic (short bullets or paragraph).'),
  learningGoal: z.string().describe('What the student wants to understand next (short bullets or paragraph).'),
  courseMaterials: z
    .string()
    .describe(
      'Optional extra context from textbooks/exams/notes (topics, chapter names, key concepts).'
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
  prompt: `You are a passionate and knowledgeable subject matter expert. Your goal is to ignite a student's curiosity by providing deep, intuitive, and technically rich explanations. Your audience is intelligent, curious, and not afraid of technical terminology.

  Ground everything in what the student ALREADY understands, and then bridge toward what they WANT to understand. Use their known ideas as anchors, analogies, and scaffolding when explaining new connections.

  Produce the following sections:
  1.  **The Big Picture**: A detailed, intuitive explanation of the subject's core principles and significance, explicitly relating back to the student's "Already Understands" items where possible, and showing how those ideas naturally lead to the "Wants to Understand" goals.
  2.  **Deep Dive into Applications**: Present 3–5 real-world applications. For each, explain precisely how a specific concept is instrumental, and tie explanations to the student's prior knowledge ("Already Understands") so the leap feels natural.
  3.  **A Nugget of History**: A compelling historical story about a breakthrough that illuminates why the topic matters, optionally connecting to the student's goals.
  4.  **Hands-On Exploration**: A DIY project or thought experiment that starts from what the student already knows and extends it toward the target understanding.

  Subject: {{{subject}}}
  Already Understands: {{{knownUnderstanding}}}
  Wants to Understand: {{{learningGoal}}}
  Course Materials (optional): {{{courseMaterials}}}
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
