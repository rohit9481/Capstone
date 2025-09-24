// adaptiveLearningService.js
import { generateJson } from "./aiClient"; // Corrected named import

class AdaptiveLearningService {
  async generatePersonalizedExplanation(concept, userContext = {}) {
    try {
      const { mistakePatterns = [], learningStyle = "visual", currentMasteryLevel = 0, previousAttempts = 0, preferredComplexity = "intermediate" } = userContext;

      const promptContent = `Create a personalized explanation for this concept:

Concept: ${concept?.name}
Description: ${concept?.description}
User's Mastery Level: ${currentMasteryLevel}%
Previous Attempts: ${previousAttempts}
Learning Style: ${learningStyle}
Preferred Complexity: ${preferredComplexity}
Common Mistakes: ${mistakePatterns?.join(", ") || "None identified"}
Key Principles: ${concept?.keyPrinciples?.join(", ") || "N/A"}`;

      const explanationResult = await generateJson({
        systemPrompt: `You are an adaptive learning AI tutor. Create personalized explanations that address specific knowledge gaps and learning preferences.`,
        prompt: promptContent,
        json_schema: {
          name: "personalized_explanation_response",
          schema: {
            type: "object",
            properties: {
              overview: { type: "string" },
              detailedExplanation: { type: "string" },
              keyPoints: { type: "array", items: { type: "string" } },
              examples: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    description: { type: "string" },
                    type: { type: "string" },
                  },
                  required: ["title", "description", "type"],
                },
              },
              practiceExercises: { type: "array", items: { type: "string" } },
              commonPitfalls: { type: "array", items: { type: "string" } },
              realWorldApplications: {
                type: "array",
                items: { type: "string" },
              },
              nextSteps: { type: "array", items: { type: "string" } },
              estimatedStudyTime: { type: "string" },
              difficultyAdjustment: { type: "string" },
            },
            required: ["overview", "detailedExplanation", "keyPoints", "examples"],
            additionalProperties: false,
          },
        },
      });

      return {
        ...explanationResult,
        conceptId: concept?.id,
        conceptName: concept?.name,
        generatedAt: new Date().toISOString(),
        personalizedFor: {
          masteryLevel: currentMasteryLevel,
          learningStyle,
          preferredComplexity,
        },
      };
    } catch (error) {
      console.error("Error generating personalized explanation:", error);
      throw new Error("Failed to generate personalized explanation");
    }
  }

  async createAudioScript(explanation, voiceSettings = {}) {
    try {
      const { pace = "normal", tone = "encouraging", includeExamples = true, maxDuration = "5 minutes" } = voiceSettings;

      const promptContent = `Create an audio script for this explanation:

Content Overview: ${explanation?.overview}
Key Points: ${explanation?.keyPoints?.join(", ")}
Examples: ${explanation?.examples?.map((ex) => ex?.title)?.join(", ")}

Voice Settings:
- Pace: ${pace}
- Tone: ${tone}
- Include Examples: ${includeExamples}
- Max Duration: ${maxDuration}`;

      const scriptResult = await generateJson({
        systemPrompt: `You are a script writer for educational AI avatars. Create engaging, conversational audio scripts that make complex concepts easy to understand.`,
        prompt: promptContent,
        json_schema: {
          name: "audio_script_response",
          schema: {
            type: "object",
            properties: {
              script: { type: "string" },
              segments: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    text: { type: "string" },
                    emphasis: { type: "string" },
                    pauseDuration: { type: "number" },
                    type: { type: "string" },
                  },
                  required: ["text", "type"],
                },
              },
              estimatedDuration: { type: "string" },
              keyEmphasisPoints: { type: "array", items: { type: "string" } },
              transitionCues: { type: "array", items: { type: "string" } },
            },
            required: ["script", "segments", "estimatedDuration"],
            additionalProperties: false,
          },
        },
      });

      return {
        ...scriptResult,
        createdAt: new Date().toISOString(),
        voiceSettings,
        conceptId: explanation?.conceptId,
      };
    } catch (error) {
      console.error("Error creating audio script:", error);
      throw new Error("Failed to create audio script");
    }
  }

  async analyzeLearningPatterns(learningData) {
    try {
      const { questionResponses = [], studyTimes = [], conceptMastery = {}, preferredQuestionTypes = {}, mistakePatterns = [] } = learningData;

      const unansweredCount = questionResponses.filter((q) => q.status === "unanswered").length;

      const promptContent = `Analyze this learning data and provide insights:

Question Responses: ${questionResponses?.length} total
Unanswered Questions: ${unansweredCount}
Average Study Time: ${studyTimes?.length > 0 ? (studyTimes?.reduce((a, b) => a + b, 0) / studyTimes?.length)?.toFixed(1) : 0} minutes
Concept Mastery Levels: ${Object.entries(conceptMastery)
        ?.map(([concept, level]) => `${concept}: ${level}%`)
        ?.join(", ")}
Preferred Question Types: ${Object.entries(preferredQuestionTypes)
        ?.map(([type, count]) => `${type}: ${count}`)
        ?.join(", ")}
Common Mistakes: ${mistakePatterns?.join(", ") || "N/A"}`;

      const analysisResult = await generateJson({
        systemPrompt: `You are an educational data analyst. Analyze learning patterns to provide actionable insights for adaptive learning. If there are unanswered questions, treat them as possible knowledge gaps, confidence issues, or time-management challenges.`,
        prompt: promptContent,
        json_schema: {
          name: "learning_analysis_response",
          schema: {
            type: "object",
            properties: {
              strengths: { type: "array", items: { type: "string" } },
              weaknesses: { type: "array", items: { type: "string" } },
              optimalStudyTime: { type: "string" },
              recommendedStrategies: { type: "array", items: { type: "string" } },
              focusAreas: { type: "array", items: { type: "string" } },
              studyPlan: {
                type: "object",
                properties: {
                  dailyGoals: { type: "array", items: { type: "string" } },
                  weeklyMilestones: { type: "array", items: { type: "string" } },
                  reviewSchedule: { type: "string" },
                },
                required: ["dailyGoals", "weeklyMilestones"],
              },
              motivationalInsights: { type: "array", items: { type: "string" } },
              nextLearningGoals: { type: "array", items: { type: "string" } },
            },
            required: ["strengths", "weaknesses", "recommendedStrategies", "focusAreas"],
            additionalProperties: false,
          },
        },
      });

      return {
        ...analysisResult,
        analyzedAt: new Date().toISOString(),
        dataPoints: {
          totalResponses: questionResponses?.length,
          unansweredCount,
          averageStudyTime: studyTimes?.length > 0 ? (studyTimes?.reduce((a, b) => a + b, 0) / studyTimes?.length)?.toFixed(1) : 0,
          conceptsStudied: Object.keys(conceptMastery)?.length,
          overallProgress: Object.values(conceptMastery)?.length > 0 ? (Object.values(conceptMastery)?.reduce((a, b) => a + b, 0) / Object.values(conceptMastery)?.length)?.toFixed(1) : 0,
        },
      };
    } catch (error) {
      console.error("Error analyzing learning patterns:", error);
      throw new Error("Failed to analyze learning patterns");
    }
  }

  async generateAdaptiveHints(question, userContext = {}) {
    try {
      const { attemptCount = 0, timeSpent = 0, previousHints = [], masteryLevel = 0 } = userContext;

      // Handle unanswered questions separately
      if (question?.status === "unanswered") {
        return {
          hints: [
            {
              level: 1,
              text: "Try giving this question a shot — even a partial attempt helps me adapt better.",
              type: "motivation",
              revealAmount: "none",
            },
            {
              level: 2,
              text: "Start with the simplest part of the problem. You don’t need to solve it all at once.",
              type: "strategy",
              revealAmount: "minimal",
            },
          ],
          encouragement: "Skipping is fine, but practicing attempts helps me give you better feedback.",
          studyTip: "Build the habit of at least trying. Effort, not perfection, drives progress.",
          questionId: question?.id,
          generatedAt: new Date().toISOString(),
          userContext: {
            attemptCount,
            timeSpent,
            masteryLevel,
          },
        };
      }

      const promptContent = `Generate progressive hints for this question:

Question: ${question?.question}
Question Type: ${question?.type}
Context: ${question?.context || "N/A"}
User's Attempt Count: ${attemptCount}
Time Spent: ${timeSpent} seconds
Previous Hints Given: ${previousHints?.join(", ") || "None"}
User's Mastery Level: ${masteryLevel}%`;

      const hintsResult = await generateJson({
        systemPrompt: `You are a supportive AI tutor. Provide progressive hints that guide without giving away the answer.`,
        prompt: promptContent,
        json_schema: {
          name: "adaptive_hints_response",
          schema: {
            type: "object",
            properties: {
              hints: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    level: { type: "number" },
                    text: { type: "string" },
                    type: { type: "string" },
                    revealAmount: { type: "string" },
                  },
                  required: ["level", "text", "type"],
                },
              },
              encouragement: { type: "string" },
              studyTip: { type: "string" },
            },
            required: ["hints", "encouragement"],
            additionalProperties: false,
          },
        },
      });

      return {
        ...hintsResult,
        questionId: question?.id,
        generatedAt: new Date().toISOString(),
        userContext: {
          attemptCount,
          timeSpent,
          masteryLevel,
        },
      };
    } catch (error) {
      console.error("Error generating adaptive hints:", error);
      throw new Error("Failed to generate adaptive hints");
    }
  }

  async createPersonalizedStudyPlan(userProfile, availableConcepts) {
    try {
      const { learningGoals = [], availableTime = "1 hour", preferredPace = "moderate", currentLevel = "beginner", weakAreas = [], strongAreas = [] } = userProfile;

      const promptContent = `Create a personalized study plan:

Learning Goals: ${learningGoals?.join(", ")}
Available Time: ${availableTime} per session
Preferred Pace: ${preferredPace}
Current Level: ${currentLevel}
Weak Areas: ${weakAreas?.join(", ")}
Strong Areas: ${strongAreas?.join(", ")}
Available Concepts: ${availableConcepts?.map((c) => c?.name)?.join(", ")}`;

      const planResult = await generateJson({
        systemPrompt: `You are a personalized learning advisor. Create effective study plans that align with user goals and constraints.`,
        prompt: promptContent,
        json_schema: {
          name: "study_plan_response",
          schema: {
            type: "object",
            properties: {
              planOverview: { type: "string" },
              dailySessions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    day: { type: "number" },
                    concepts: { type: "array", items: { type: "string" } },
                    activities: { type: "array", items: { type: "string" } },
                    duration: { type: "string" },
                    goals: { type: "array", items: { type: "string" } },
                  },
                  required: ["day", "concepts", "activities", "duration"],
                },
              },
              weeklyMilestones: { type: "array", items: { type: "string" } },
              progressCheckpoints: { type: "array", items: { type: "string" } },
              reviewSchedule: { type: "string" },
              motivationStrategies: { type: "array", items: { type: "string" } },
              adaptationTriggers: { type: "array", items: { type: "string" } },
            },
            required: ["planOverview", "dailySessions", "weeklyMilestones"],
            additionalProperties: false,
          },
        },
      });

      return {
        ...planResult,
        createdAt: new Date().toISOString(),
        userProfile,
        totalConcepts: availableConcepts?.length,
        estimatedCompletionTime: this.calculateCompletionTime(planResult?.dailySessions),
        nextReviewDate: this.calculateNextReviewDate(),
      };
    } catch (error) {
      console.error("Error creating study plan:", error);
      throw new Error("Failed to create personalized study plan");
    }
  }

  calculateCompletionTime(dailySessions) {
    if (!dailySessions?.length) return "0 days";

    const totalDays = dailySessions?.length;
    const weeks = Math.ceil(totalDays / 7);

    if (weeks === 1) return `${totalDays} days`;
    return `${weeks} weeks`;
  }

  calculateNextReviewDate() {
    const nextReview = new Date();
    nextReview?.setDate(nextReview?.getDate() + 7);
    return nextReview?.toISOString();
  }
}

export default new AdaptiveLearningService();
