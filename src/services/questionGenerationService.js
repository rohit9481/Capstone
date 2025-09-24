import { generateJson } from "./aiClient";
import { v4 as uuidv4 } from "uuid";

// Escape special characters
const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Normalize strings for comparison
const normalize = (str) =>
  str
    ?.trim()
    .toLowerCase()
    .replace(/[.,!?]/g, "");

// Fuzzy match for short answers
const fuzzyMatch = (answer, correctAnswers) => {
  const userNorm = normalize(answer);
  return correctAnswers.some((ans) => normalize(ans) === userNorm);
};

// Sanitize AI JSON string to remove trailing commas and misplaced keys
const sanitizeJsonString = (str) => {
  return str
    .replace(/,\s*([\]}])/g, "$1") // remove trailing commas
    .replace(/},\s*("correctAnswer":)/g, "}$1") // fix misplaced correctAnswer
    .replace(/},\s*("explanation":)/g, "}$1"); // fix misplaced explanation
};

class QuestionGenerationService {
  constructor() {
    this.answerStore = new Map(); // full questions stored here
    this.performanceStore = new Map(); // conceptId → { correct, total, name }
  }

  async generateQuestionsForConcept(concept, options = {}) {
    if (!concept || !concept.name) throw new Error("Invalid concept provided.");

    const { questionCount = 5, questionTypes = ["multiple_choice", "true_false", "short_answer"], difficultyLevel = concept.difficulty || "Intermediate" } = options;

    const allQuestions = [];
    let attempts = 0;
    const MAX_ATTEMPTS = 3;

    while (allQuestions.length < questionCount && attempts < MAX_ATTEMPTS) {
      attempts++;
      const remaining = questionCount - allQuestions.length;

      const promptContent = `Generate exactly ${remaining} educational questions for the concept: "${concept.name}".
Description: ${concept.description || "N/A"}
Difficulty: ${difficultyLevel}
Question Types: ${questionTypes.join(", ")}
IMPORTANT: Your JSON must NOT contain trailing commas or syntax errors. Strictly follow JSON format.`;

      let generationResult;
      try {
        const rawResult = await generateJson({
          systemPrompt: "You are an expert educational content creator. Strictly follow the JSON schema.",
          prompt: promptContent,
          json_schema: {
            name: "questions_generation_response",
            schema: {
              type: "object",
              properties: {
                questions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      type: { type: "string" },
                      difficulty: { type: "string" },
                      question: { type: "string" },
                      context: { type: "string" },
                      options: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            id: { type: "string" },
                            text: { type: "string" },
                            explanation: { type: "string" },
                          },
                          required: ["id", "text"],
                        },
                      },
                      correctAnswer: { type: "string" },
                      sampleAnswers: {
                        type: "array",
                        items: { type: "string" },
                      },
                      explanation: { type: "string" },
                    },
                    required: ["id", "type", "difficulty", "question", "correctAnswer"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["questions"],
              additionalProperties: false,
            },
          },
        });

        generationResult = sanitizeJsonString(JSON.stringify(rawResult));
        generationResult = JSON.parse(generationResult);
      } catch (err) {
        console.warn("Failed to parse AI JSON, retrying...", err);
        continue;
      }

      if (!generationResult?.questions?.length) continue;

      generationResult.questions.forEach((aiQuestion) => {
        if (allQuestions.length >= questionCount) return;

        const uniqueId = uuidv4();
        const safeCorrectAnswer = escapeRegExp(String(aiQuestion.correctAnswer));
        const sanitizedContext = aiQuestion.context ? aiQuestion.context.replace(new RegExp(safeCorrectAnswer, "gi"), "_____") : null;

        const fullQuestionData = {
          ...aiQuestion,
          id: uniqueId,
          number: allQuestions.length + 1,
          correctAnswerId: null,
          conceptId: concept.id,
          conceptName: concept.name,
          context: sanitizedContext,
          createdAt: new Date().toISOString(),
        };

        // ✅ Handle both ID ("C") and text ("Randomly trying...") for MCQs
        if (aiQuestion.type === "multiple_choice" && aiQuestion.options?.length) {
          let correctOption = aiQuestion.options.find((opt) => normalize(opt.id) === normalize(aiQuestion.correctAnswer));

          if (!correctOption) {
            correctOption = aiQuestion.options.find((opt) => normalize(opt.text) === normalize(aiQuestion.correctAnswer));
          }

          fullQuestionData.correctAnswerId = correctOption?.id ?? aiQuestion.options[0].id;
          fullQuestionData.correctAnswer = correctOption?.text ?? aiQuestion.options[0].text;
        }

        if (aiQuestion.type === "true_false") {
          fullQuestionData.correctAnswer = aiQuestion.correctAnswer;
        }

        this.answerStore.set(uniqueId, fullQuestionData);

        allQuestions.push({
          id: uniqueId,
          type: aiQuestion.type,
          difficulty: aiQuestion.difficulty,
          question: aiQuestion.question,
          context: sanitizedContext,
          options: aiQuestion.options?.map(({ id, text }) => ({ id, text })) || [],
          conceptId: concept.id,
          conceptName: concept.name,
          number: fullQuestionData.number,
          createdAt: fullQuestionData.createdAt,
        });
      });
    }

    return allQuestions;
  }

  getQuestionWithAnswer(questionId) {
    if (!this.answerStore.has(questionId)) throw new Error("Question not found or expired.");
    return this.answerStore.get(questionId);
  }

  async evaluateAnswer(publicQuestion, userAnswer) {
    const fullQuestion = this.getQuestionWithAnswer(publicQuestion.id);

    let isCorrectLocal = false;

    switch (fullQuestion.type) {
      case "multiple_choice": {
        isCorrectLocal = String(userAnswer) === String(fullQuestion.correctAnswerId);
        break;
      }
      case "true_false": {
        isCorrectLocal = normalize(userAnswer) === normalize(fullQuestion.correctAnswer);
        break;
      }
      case "short_answer": {
        const correctAnswers = [fullQuestion.correctAnswer, ...(fullQuestion.sampleAnswers || [])];
        isCorrectLocal = fuzzyMatch(userAnswer, correctAnswers);
        break;
      }
      default:
        console.warn("Unsupported question type:", fullQuestion.type);
    }

    // Update concept-level performance
    const conceptPerf = this.performanceStore.get(fullQuestion.conceptId) || {
      correct: 0,
      total: 0,
      name: fullQuestion.conceptName,
    };
    conceptPerf.total += 1;
    if (isCorrectLocal) conceptPerf.correct += 1;
    this.performanceStore.set(fullQuestion.conceptId, conceptPerf);

    // AI feedback
    let optionsText = "";
    if (fullQuestion.type === "multiple_choice" && fullQuestion.options?.length) {
      optionsText = fullQuestion.options.map((o) => `${o.id}: ${o.text}`).join("\n");
    }

    const promptContent = `Evaluate the user's answer:
- Question: ${fullQuestion.question}
${optionsText ? "- Options:\n" + optionsText : ""}
- Correct Answer: ${fullQuestion.correctAnswer}
- User Answer: ${userAnswer}
- Definitive Correctness: ${isCorrectLocal}
Provide concise, constructive feedback and explanation.`;

    const evaluationResult = await generateJson({
      systemPrompt: "You are an expert tutor. Use the correctness flag as truth but explain based on context/options.",
      prompt: promptContent,
      json_schema: {
        name: "answer_evaluation_response",
        schema: {
          type: "object",
          properties: {
            isCorrect: { type: "boolean" },
            score: { type: "number" },
            feedback: { type: "string" },
            explanation: { type: "string" },
            areasForImprovement: { type: "array", items: { type: "string" } },
            hints: { type: "array", items: { type: "string" } },
            nextSteps: { type: "string" },
          },
          required: ["isCorrect", "score", "feedback", "explanation"],
          additionalProperties: false,
        },
      },
    });

    // Compute strong/weak areas with topic + score %
    const strongAreas = [];
    const weakAreas = [];
    for (const [conceptId, perf] of this.performanceStore.entries()) {
      const accuracy = perf.correct / perf.total;
      const scorePercent = Math.round(accuracy * 100);

      const areaObj = {
        topic: perf.name,
        score: scorePercent,
      };

      if (accuracy >= 0.7) {
        strongAreas.push(areaObj);
      } else {
        weakAreas.push(areaObj);
      }
    }

    return {
      ...evaluationResult,
      isCorrect: isCorrectLocal,
      score: isCorrectLocal ? 1 : 0,
      questionId: fullQuestion.id,
      questionNumber: fullQuestion.number,
      conceptId: fullQuestion.conceptId,
      correctAnswer: fullQuestion.correctAnswer,
      context: fullQuestion.context,
      areasForImprovement: evaluationResult.areasForImprovement || [],
      hints: evaluationResult.hints || [],
      nextSteps: evaluationResult.nextSteps || "",
      evaluatedAt: new Date().toISOString(),
      userAnswer,
      strongAreas,
      weakAreas,
    };
  }

  // ✅ Mark unanswered questions explicitly as incorrect
  markUnanswered(publicQuestion) {
    const fullQuestion = this.getQuestionWithAnswer(publicQuestion.id);

    const conceptPerf = this.performanceStore.get(fullQuestion.conceptId) || {
      correct: 0,
      total: 0,
      name: fullQuestion.conceptName,
    };
    conceptPerf.total += 1; // unanswered counts toward total
    this.performanceStore.set(fullQuestion.conceptId, conceptPerf);

    return {
      isCorrect: false,
      score: 0,
      feedback: "No answer submitted. The system marked this as incorrect.",
      explanation: "You did not attempt this question, so it was automatically marked incorrect.",
      areasForImprovement: ["Always attempt every question to maximize learning."],
      hints: [],
      nextSteps: "Review the material and try again.",
      questionId: fullQuestion.id,
      questionNumber: fullQuestion.number,
      conceptId: fullQuestion.conceptId,
      correctAnswer: fullQuestion.correctAnswer,
      context: fullQuestion.context,
      userAnswer: null,
      evaluatedAt: new Date().toISOString(),
    };
  }

  shuffleQuestions(questions) {
    if (!Array.isArray(questions)) return [];
    const shuffled = [...questions];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.map((q, idx) => ({ ...q, number: idx + 1 }));
  }
}

export default new QuestionGenerationService();
