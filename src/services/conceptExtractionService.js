import { generateJson } from "./aiClient";
import { v4 as uuidv4 } from "uuid";

class ConceptExtractionService {
  // Extract concepts from file analysis using AI
  async extractConcepts(analysisData) {
    if (!analysisData) return [];

    const contentText = analysisData.text || analysisData.summary || "N/A";

    const prompt = `
      Extract key learning concepts from the following content:
      "${contentText}"

      Return a JSON array of concepts with these fields:
      - id
      - name
      - description
      - difficulty (Beginner, Intermediate, Advanced)
      - prerequisites (array of strings)
      - subConcepts (array of strings)
      - examples (array of strings)
      - misconceptions (array of strings)
      - keyPrinciples (array of strings)
      - estimatedTime (string, e.g., "10 min")
      - bloomsLevel (Remember, Understand, Apply)
      - masteryLevel (default 0)
      - attempts (default 0)
      - correctAnswers (default 0)
    `;

    try {
      const aiResponse = await generateJson({
        systemPrompt: "You are an expert educational content extractor.",
        prompt,
        json_schema: {
          name: "ai_concept_extraction",
          schema: {
            type: "object",
            properties: {
              concepts: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    name: { type: "string" },
                    description: { type: "string" },
                    difficulty: { type: "string" },
                    prerequisites: { type: "array", items: { type: "string" } },
                    subConcepts: { type: "array", items: { type: "string" } },
                    examples: { type: "array", items: { type: "string" } },
                    misconceptions: { type: "array", items: { type: "string" } },
                    keyPrinciples: { type: "array", items: { type: "string" } },
                    estimatedTime: { type: "string" },
                    bloomsLevel: { type: "string" },
                    masteryLevel: { type: "number" },
                    attempts: { type: "number" },
                    correctAnswers: { type: "number" },
                  },
                  required: ["id", "name", "description", "difficulty", "prerequisites", "subConcepts", "examples", "misconceptions", "keyPrinciples", "estimatedTime", "bloomsLevel", "masteryLevel", "attempts", "correctAnswers"],
                },
              },
            },
            required: ["concepts"],
            additionalProperties: false,
          },
        },
      });

      const rawConcepts = aiResponse?.concepts;
      const conceptsArray = Array.isArray(rawConcepts) ? rawConcepts : [];

      // Map each concept with defaults to ensure UI never breaks
      const concepts = conceptsArray.map((c) => ({
        id: c.id || uuidv4(),
        name: c.name || "Unnamed Concept",
        description: c.description || "",
        difficulty: c.difficulty || "Intermediate",
        prerequisites: Array.isArray(c.prerequisites) ? c.prerequisites : [],
        subConcepts: Array.isArray(c.subConcepts) ? c.subConcepts : [],
        examples: Array.isArray(c.examples) ? c.examples : [],
        misconceptions: Array.isArray(c.misconceptions) ? c.misconceptions : [],
        keyPrinciples: Array.isArray(c.keyPrinciples) ? c.keyPrinciples : [],
        estimatedTime: c.estimatedTime || "10 min",
        bloomsLevel: c.bloomsLevel || "Remember",
        masteryLevel: typeof c.masteryLevel === "number" ? c.masteryLevel : 0,
        attempts: typeof c.attempts === "number" ? c.attempts : 0,
        correctAnswers: typeof c.correctAnswers === "number" ? c.correctAnswers : 0,
      }));

      return concepts;
    } catch (err) {
      console.error("AI concept extraction failed:", err);
      return [];
    }
  }

  // Keep existing pathway creation so UI works
  createLearningPathway(concepts) {
    return concepts.map((c, idx) => ({
      ...c,
      sequence: idx + 1,
    }));
  }
}

export default new ConceptExtractionService();
