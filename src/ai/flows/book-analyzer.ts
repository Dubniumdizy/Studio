"use server";

import { ai } from "@/ai/genkit";
import { z } from "genkit";

// INPUT: one or more pages (PDF or images) as data URIs
const PageSchema = z.object({
  name: z.string().describe("Original file name of the page or PDF."),
  dataUri: z
    .string()
    .describe(
      "A PDF page or image as a data URI with MIME type and Base64 encoding. Example: 'data:application/pdf;base64,...' or 'data:image/png;base64,...'"
    ),
});

const AnalyzeBookInputSchema = z.object({
  pages: z
    .array(PageSchema)
    .describe("A small number of pages (a chapter max) from a textbook or notes."),
});
export type AnalyzeBookInput = z.infer<typeof AnalyzeBookInputSchema>;

// OUTPUT
const FigureSchema = z.object({
  title: z.string().describe("Short name of the figure/graph/diagram."),
  description: z
    .string()
    .describe("What the picture/graph shows, and why it's useful to understand the chapter."),
  ascii: z
    .string()
    .optional()
    .describe("Optional tiny ASCII sketch if relevant (keep to <10 lines)."),
});

const ConceptSchema = z.object({
  name: z.string().describe("Definition/Theorem/Proof name."),
  type: z
    .enum(["Definition", "Theorem", "Proof"]) 
    .describe("Which kind of concept this is."),
  statement: z.string().describe("Formal statement/definition (concise)."),
  proofOutline: z
    .string()
    .optional()
    .describe("If type is Proof or Theorem, a brief proof outline."),
});

const ProblemGuideSchema = z.object({
  problemType: z.string().describe("Name/description of the problem style."),
  steps: z.array(z.string()).describe("Step-by-step method to solve that problem type."),
  miniExample: z
    .string()
    .optional()
    .describe("Tiny worked micro-example demonstrating the steps."),
});

const AnalyzeBookOutputSchema = z.object({
  summary: z
    .string()
    .describe("Clear chapter summary in 5-10 bullet points or short paragraphs."),
  shortExamples: z
    .string()
    .describe("A few concise micro-examples that illustrate core ideas."),
  figures: z.array(FigureSchema).describe("Suggested figures/graphs/diagrams to understand the material."),
  concepts: z
    .array(ConceptSchema)
    .describe("List of Definitions/Theorems/Proofs present in the pages."),
  problemSolvingGuides: z
    .array(ProblemGuideSchema)
    .describe("How to solve the typical problems from this chapter."),
  practiceAdvice: z
    .string()
    .describe(
      "Specific practice advice with an emphasis on mimicking examples until the learner can solve them independently."
    ),
  keyTerms: z.array(z.string()).optional().describe("Optional list of key terms.")
});
export type AnalyzeBookOutput = z.infer<typeof AnalyzeBookOutputSchema>;

export async function analyzeBook(input: AnalyzeBookInput): Promise<AnalyzeBookOutput> {
  return analyzeBookFlow(input);
}

// Prompt
const prompt = ai.definePrompt({
  name: "analyzeBookPrompt",
  input: { schema: AnalyzeBookInputSchema },
  output: { schema: AnalyzeBookOutputSchema },
  prompt: `You are an expert STEM tutor and book chapter analyzer. Analyze the uploaded textbook pages (a chapter max). Respond in English.

Provide the following outputs:
- summary: 5–10 concise bullets or short paragraphs capturing the big picture.
- shortExamples: 2–5 tiny worked micro-examples (keep compact; show key algebra/calculus steps as text; no LaTeX required).
- figures: list of figures/graphs/diagrams that would help; include a short description and, when useful, a very small ASCII sketch (<=10 lines) to convey the idea.
- concepts: enumerate Definitions, Theorems, and Proofs with formal statements; include a brief proofOutline for theorems/proofs if possible.
- problemSolvingGuides: for the main question types in the chapter, give step-by-step instructions and a miniExample.
- practiceAdvice: actionable plan with emphasis on: mimic examples until you can do them on your own, then vary numbers/conditions, then mix problems.
- keyTerms (optional): list important vocabulary.

INPUT PAGES:
{{#each pages}}
Page: {{{this.name}}}
{{media url=this.dataUri}}
{{/each}}
`,
});

const analyzeBookFlow = ai.defineFlow(
  {
    name: "analyzeBookFlow",
    inputSchema: AnalyzeBookInputSchema,
    outputSchema: AnalyzeBookOutputSchema,
  },
  async (input) => {
    try {
      const { output } = await prompt(input);
      if (output) return output;
      throw new Error("No output from model");
    } catch (err) {
      // Offline/fallback: build a minimal but useful structure so the UI renders
      const names = (input.pages || []).map((p) => p.name).filter(Boolean);
      const list = names.length ? `Files: ${names.join(", ")}` : "No filenames provided.";
      const fallback: AnalyzeBookOutput = {
        summary:
          `Analysis unavailable (offline or model error). ${list}\n` +
          `Read the selection and distill main ideas, definitions, and core problem types.`,
        shortExamples:
          "Example 1: Show a tiny worked example for the core formula.\n" +
          "Example 2: Vary numbers to check understanding.",
        figures: [
          {
            title: "Key diagram",
            description: "A simple diagram illustrating the primary relationship.",
            ascii: "+---+\n|   |-->\n+---+",
          },
        ],
        concepts: [
          {
            name: "Main definition",
            type: "Definition",
            statement: "State the core definition succinctly.",
          },
        ],
        problemSolvingGuides: [
          {
            problemType: "Canonical problem",
            steps: [
              "Identify knowns/unknowns",
              "Write governing relations",
              "Solve symbolically, then substitute numbers",
              "Check units and reasonableness",
            ],
            miniExample: "Given a simple input, apply the formula and compute the result.",
          },
        ],
        practiceAdvice:
          "Mimic the worked examples step-by-step until you can reproduce them without looking. Then change numbers and conditions. Finally, mix problem types to test transfer.",
        keyTerms: [],
      };
      return fallback;
    }
  }
);

