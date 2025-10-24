'use server';
/**
 * @fileOverview Exam analyzer AI agent.
 *
 * - analyzeExam - A function that handles the exam analysis process.
 * - AnalyzeExamInput - The input type for the analyzeExam function.
 * - AnalyzeExamOutput - The return type for the analyzeExam function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExamFileSchema = z.object({
  name: z.string().describe('The name of the exam file.'),
  // Prefer plain extracted text to avoid oversized requests
  text: z.string().optional().describe('Extracted plain text content of the PDF (preferred).'),
  dataUri: z
    .string()
    .optional()
    .describe(
      "PDF as data URI (fallback). Expected: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});

const AnalyzeExamInputSchema = z.object({
  exams: z
    .array(ExamFileSchema)
    .describe('An array of exam PDFs to analyze, including their names.'),
});
export type AnalyzeExamInput = z.infer<typeof AnalyzeExamInputSchema>;

const KeyConceptSchema = z.object({
  name: z.string().describe('The name of the proof, theorem, or definition.'),
  type: z
    .enum(['Proof', 'Theorem', 'Definition'])
    .describe('The type of the concept.'),
  occurrences: z
    .number()
    .describe('The number of times the concept appeared.'),
});

const QuestionTopicMapSchema = z.object({
  topic: z.string().describe('The theory or concept being tested.'),
  questions: z
    .array(z.string())
    .describe(
      'A list of specific question references (e.g., "Midterm 2023, Q4b") that test this topic. Do not include the full text of the questions.'
    ),
});

const AnalyzeExamOutputSchema = z.object({
  commonThemes: z.string().describe('The common themes across all exams.'),
  keywords: z
    .string()
    .describe('The most frequent and important keywords found in the exams.'),
  questionTypes: z
    .string()
    .describe(
      'The types of questions commonly asked (e.g., proofs, theorems, calculations, short answers).'
    ),
  hardQuestionTrends: z
    .string()
    .describe(
      'Analysis of trends observed in the last few questions of the exams, which are typically the most difficult.'
    ),
  keyConcepts: z
    .array(KeyConceptSchema)
    .describe(
      'A list of key proofs, theorems, and definitions identified, including their frequency.'
    ),
  adviceForPassing: z
    .string()
    .describe(
      'Advice on what to focus on to pass the exam, including key areas and example questions.'
    ),
  adviceForTopScore: z
    .string()
    .describe(
      'Advice on what to focus on to achieve the highest score, including advanced topics and example questions.'
    ),
  questionTopicMap: z
    .array(QuestionTopicMapSchema)
    .describe(
      'A mapping of key topics to the specific exam questions where they appear.'
    ),
});
export type AnalyzeExamOutput = z.infer<typeof AnalyzeExamOutputSchema>;

export async function analyzeExam(input: AnalyzeExamInput): Promise<AnalyzeExamOutput> {
  return analyzeExamFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeExamPrompt',
  input: {schema: AnalyzeExamInputSchema},
  output: {schema: AnalyzeExamOutputSchema},
  prompt: `You are an expert exam analyzer. Your task is to analyze one or more exam documents and provide a detailed breakdown. All output must be in English.

Analyze all the provided exams to identify:
1.  **Common Themes**: What are the overarching topics that appear consistently?
2.  **Keywords**: List the most important and frequent keywords.
3.  **Question Types**: What formats are the questions in (e.g., proofs, listing theorems, calculations, definitions, short answer)?
4.  **Hard Question Trends**: Analyze the last few questions of each exam, which are typically harder. What trends do you see in these questions? Are they multi-part, theoretical, or application-based?
5.  **Key Concepts**: Create a list of specific proofs, theorems, and definitions that are mentioned. For each, count how many times it appeared across all provided exams.
6.  **Advice for Passing**: Based on the analysis, provide targeted advice for a student whose goal is just to pass. What are the absolute essential topics to master? Provide an example of a typical question on these topics.
7.  **Advice for Top Score**: Provide advice for a student aiming for the highest grade. What are the more complex topics, recurring difficult question types, or nuances they should focus on? Provide an example of a challenging question.
8.  **Question Topic Map**: Create a detailed map of the **major topics** covered in the exams and group the relevant questions under them.
    - **Focus on recurring concepts**: Your goal is to create a useful study guide that highlights recurring patterns. Identify topics that appear in multiple questions or across different exams.
    - **Create meaningful topics**: Topics should be specific enough to be useful (e.g., "Solving First-Order Linear Differential Equations"), but broad enough to cover multiple related questions.
    - **Avoid overly specific topics**: Do not create a separate topic for every single question. Group similar questions together.
    - **Avoid vague categories**: Do not use overly broad or unhelpful topics like "Calculations," "Miscellaneous," or "Problem Solving." Identify the specific academic concept being tested.

Exams:
{{#each exams}}
Exam Name: {{{this.name}}}
{{#if this.text}}
{{{this.text}}}
{{else}}
{{media url=this.dataUri}}
{{/if}}
{{/each}}
`,
});

const analyzeExamFlow = ai.defineFlow(
  {
    name: 'analyzeExamFlow',
    inputSchema: AnalyzeExamInputSchema,
    outputSchema: AnalyzeExamOutputSchema,
  },
  async input => {
    try {
      const {output} = await prompt(input);
      if (output) return output;
      throw new Error('No output from model');
    } catch (err: any) {
      // Offline/failed model fallback: return a minimal but valid analysis so UI still renders and can be saved
      const fileNames = (input.exams || []).map(f => f.name).filter(Boolean)
      const list = fileNames.length ? `Files: ${fileNames.join(', ')}` : 'No filenames provided.'
      const fallback: AnalyzeExamOutput = {
        commonThemes: `Analysis unavailable (offline or model error). ${list}`,
        keywords: fileNames.map(n => n.replace(/\.[^/.]+$/, '')).join(', ') || 'exam, topics, questions',
        questionTypes: 'Unknown (offline). Likely a mix of proofs, calculations, and short answers.',
        hardQuestionTrends: 'Unavailable (offline). Often multi-part, conceptual, and application-based.',
        keyConcepts: [],
        adviceForPassing: 'Focus on fundamentals and past recurring topics. Practice representative problems from earlier sections of your exams.',
        adviceForTopScore: 'Deepen understanding of edge cases and theorems. Practice multi-step proofs and synthesis-style questions.',
        questionTopicMap: [],
      }
      return fallback
    }
  }
);
