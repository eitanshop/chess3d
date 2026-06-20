import { GoogleGenAI, Type } from "@google/genai";
import { AIMoveResponse, Difficulty } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export const getBestMove = async (fen: string, validMoves: string[], difficulty: Difficulty = 'Medium'): Promise<AIMoveResponse> => {
  if (validMoves.length === 0) {
      return { move: "", reasoning: "No valid moves available." };
  }

  if (!apiKey) {
    // Fallback if no API key is present (random move)
    console.warn("No API Key provided, returning random move.");
    const randomMove = validMoves[Math.floor(Math.random() * validMoves.length)];
    return { move: randomMove, reasoning: "מצב לא מקוון: מהלך אקראי." };
  }

  const model = "gemini-2.5-flash";
  
  let personaInstruction = "";
  if (difficulty === 'Easy') {
    personaInstruction = `
      You are a beginner chess player. 
      You know the rules, but you often make tactical mistakes and do not plan ahead. 
      Pick a valid move, but try not to pick the absolute best one unless it's obvious. 
      Your explanation should be simple and unsure.
    `;
  } else if (difficulty === 'Medium') {
    personaInstruction = `
      You are an intermediate chess club player (approx. 1500 Elo). 
      Play solid, standard moves. You can spot simple tactics but might miss complex combinations.
      Your explanation should be logical but standard.
    `;
  } else {
    personaInstruction = `
      You are a Grandmaster Chess Engine (Elo 3000+). 
      Analyze the position deeply. Find the absolute optimal move to crush your opponent.
      Your explanation should be strategic and confident.
    `;
  }

  const prompt = `
    ${personaInstruction}
    Current FEN state: "${fen}".
    Possible valid legal moves (UCI format): ${validMoves.join(', ')}.
    
    Analyze the position based on your skill level. Choose a move from the list of valid moves.
    IMPORTANT: Return the move strictly in UCI format (e.g., "e2e4", "a7a8q"). 
    DO NOT use algebraic notation with piece letters (e.g., do NOT write "Nf3" or "Nc3d5", write "g1f3" or "c3d5").
    Return the move and a very short explanation (in Hebrew).
  `;

  let lastError: any;
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              move: { type: Type.STRING, description: "The chosen move in pure UCI format (e.g. e2e4)" },
              reasoning: { type: Type.STRING, description: "Short explanation in Hebrew" }
            },
            required: ["move", "reasoning"]
          }
        }
      });

      const jsonText = response.text;
      if (!jsonText) throw new Error("Empty response from AI");
      
      return JSON.parse(jsonText) as AIMoveResponse;

    } catch (error: any) {
      lastError = error;
      console.warn(`Gemini API Error (Attempt ${attempt}/${maxRetries}):`, error.message || error);

      // Check for 503 Overloaded or specific error codes implies we should retry
      // We generally retry on most fetch errors for robustness, but specifically for 503.
      const shouldRetry = attempt < maxRetries;
      
      if (shouldRetry) {
          // Exponential backoff: 1000ms, 2000ms...
          const delay = 1000 * Math.pow(2, attempt - 1);
          await sleep(delay);
      }
    }
  }

  console.error("Gemini AI Final Error after retries:", lastError);
  
  // Fallback to random valid move on error
  const randomMove = validMoves[Math.floor(Math.random() * validMoves.length)];
  return { move: randomMove, reasoning: "שרת עמוס או לא זמין: מהלך חירום." };
};