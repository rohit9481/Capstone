import { GoogleGenerativeAI } from "@google/generative-ai";

// This object can be expanded with other clients
const clients = {
  gemini: null,
};

// Initialize the Gemini client if the key is available from the .env file
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
if (apiKey) {
  clients.gemini = new GoogleGenerativeAI(apiKey);
  console.log("Gemini client initialized.");
}

/**
 * A unified function to generate a JSON response from a Gemini model.
 * @param {object} options - The options for the AI call.
 * @param {string} options.prompt - The user prompt to send to the AI.
 * @param {object} options.json_schema - The schema for the expected JSON response.
 * @param {string} [options.model='gemini-1.5-pro-latest'] - The model to use.
 * @param {string} [options.systemPrompt='You are a helpful assistant.'] - The system-level instruction.
 * @returns {Promise<object>} The parsed JSON object from the AI's response.
 */
export async function generateJson({ prompt, json_schema, model = "gemini-1.5-pro-latest", systemPrompt = "You are a helpful assistant." }) {
  const client = clients.gemini;

  if (!client) {
    throw new Error("Gemini client is not initialized. Check your VITE_GEMINI_API_KEY in the .env file.");
  }

  // Gemini requires instructions for JSON output to be part of the main prompt
  const fullPrompt = `
    ${systemPrompt}

    User prompt: "${prompt}"

    Respond ONLY in valid JSON that conforms to the following schema. Do not include any other text, explanations, or markdown formatting like \`\`\`json.

    JSON Schema:
    ${JSON.stringify(json_schema, null, 2)}
  `;

  let rawContent = ""; // Variable to hold the raw response for debugging

  try {
    const generativeModel = client.getGenerativeModel({ model: model });
    const result = await generativeModel.generateContent(fullPrompt);
    const response = result.response;
    rawContent = response.text();

    if (!rawContent) {
      throw new Error("AI response was empty or malformed.");
    }

    // --- FIX: Clean the string before parsing ---
    // Remove markdown fences (```json ... ```) and trim whitespace
    const cleanedContent = rawContent
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    return JSON.parse(cleanedContent); // Parse the cleaned string
  } catch (error) {
    console.error("Error generating JSON from AI:", error);
    // For debugging, log the raw response that failed to parse
    if (error instanceof SyntaxError) {
      console.error("Raw AI response that failed parsing:", rawContent);
    }
    throw new Error("Failed to get a valid response from the AI.");
  }
}
