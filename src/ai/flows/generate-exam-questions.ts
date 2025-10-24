'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ExamFileSchema = z.object({
  name: z.string().describe('The name of the exam file.'),
  dataUri: z.string().describe('A PDF exam as a data URI with MIME type and Base64 encoding.'),
});

const GenerateExamQuestionsInputSchema = z.object({
  exams: z.array(ExamFileSchema).describe('Array of exam PDFs to analyze and use for question generation.'),
  numberOfQuestions: z.number().describe('Number of new questions to generate (default 10).').default(10),
});
export type GenerateExamQuestionsInput = z.infer<typeof GenerateExamQuestionsInputSchema>;

const QuestionSchema = z.object({
  questionNumber: z.number().describe('Question number.'),
  question: z.string().describe('The question text.'),
  solution: z.string().describe('Step-by-step solution or expected answer.'),
  difficulty: z.enum(['easy', 'medium', 'hard']).describe('Difficulty level relative to source exams.'),
});

const GenerateExamQuestionsOutputSchema = z.object({
  examTitle: z.string().describe('Descriptive title for the generated exam.'),
  questions: z.array(QuestionSchema).describe('Array of generated questions with solutions.'),
  sourceExams: z.array(z.string()).describe('Names of source exams used.'),
});
export type GenerateExamQuestionsOutput = z.infer<typeof GenerateExamQuestionsOutputSchema>;

export async function generateExamQuestions(input: GenerateExamQuestionsInput): Promise<GenerateExamQuestionsOutput> {
  return generateExamQuestionsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateExamQuestionsPrompt',
  input: { schema: GenerateExamQuestionsInputSchema },
  output: { schema: GenerateExamQuestionsOutputSchema },
  prompt: `You are an expert exam question generator. Analyze the provided exam(s) and generate new, similar questions that test the same concepts and difficulty levels.

**Task:**
1. Identify the key topics, concepts, and question types from the source exam(s).
2. Generate {{numberOfQuestions}} new questions that:
   - Cover similar topics with appropriate difficulty
   - Follow the same format and style as source exams
   - Test understanding, not just memorization
   - Include multi-part questions where relevant
3. For each question, provide a detailed step-by-step solution.
4. Classify each question as easy, medium, or hard based on the source exams' distribution.

**Output Format:**
Generate questions numbered 1 through {{numberOfQuestions}}. Provide clear, complete solutions for each.

**Source Exams:**
{{#each exams}}
Exam: {{{this.name}}}
{{media url=this.dataUri}}
{{/each}}

Generate {{numberOfQuestions}} new exam questions based on the patterns above.`,
});

const generateExamQuestionsFlow = ai.defineFlow(
  {
    name: 'generateExamQuestionsFlow',
    inputSchema: GenerateExamQuestionsInputSchema,
    outputSchema: GenerateExamQuestionsOutputSchema,
  },
  async (input) => {
    try {
      const { output } = await prompt(input);
      if (output) return output;
      throw new Error('No output from model');
    } catch (err: any) {
      // Offline/fallback: return sample questions so UI still renders
      const sourceNames = (input.exams || []).map((e) => e.name).filter(Boolean);
      const fallback: GenerateExamQuestionsOutput = {
        examTitle: `Generated Exam - ${new Date().toLocaleDateString()}`,
        sourceExams: sourceNames,
        questions: Array.from({ length: input.numberOfQuestions || 10 }, (_, i) => ({
          questionNumber: i + 1,
          question: `Question ${i + 1}: [Offline mode - AI unavailable. Please configure Gemini API key and try again.]`,
          solution: `Solution ${i + 1}: Unable to generate solutions in offline mode.`,
          difficulty: ['easy', 'medium', 'hard'][i % 3] as 'easy' | 'medium' | 'hard',
        })),
      };
      return fallback;
    }
  }
);
