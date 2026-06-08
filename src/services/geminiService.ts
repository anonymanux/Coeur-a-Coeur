import { GoogleGenAI, Type } from "@google/genai";
import { logToErrorFile } from "../lib/logger";

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  logToErrorFile("GEMINI_API_KEY is missing", "CONFIG_CHECK");
}

const ai = new GoogleGenAI({ apiKey: API_KEY as string });

export interface QuizQuestion {
  text: string;
  options: string[];
  correctAnswer: number;
  category: string;
}

export async function generateQuizQuestions(
  topic: string,
  count: number,
  difficulty: string
): Promise<QuizQuestion[]> {
  const prompt = `Générer un quiz de compatibilité amoureuse sur le thème "${topic}". 
  Nombre de questions: ${count}. 
  Difficulté: ${difficulty}.
  Les questions doivent être amusantes et révélatrices sur les préférences ou la personnalité des partenaires.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING },
              options: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING } 
              },
              correctAnswer: { type: Type.INTEGER, description: "Index de la réponse 'idéale' ou simplement un index valide pour la structure" },
              category: { type: Type.STRING }
            },
            required: ["text", "options", "correctAnswer", "category"]
          }
        }
      }
    });

    return JSON.parse(response.text || "[]");
  } catch (e) {
    logToErrorFile(e, "GEMINI_GENERATE_QUIZ");
    console.error("Failed to generate or parse Gemini response", e);
    return [];
  }
}

export async function evaluateCompatibility(
  answers1: number[],
  answers2: number[],
  questions: QuizQuestion[]
): Promise<{ score: number; analysis: string }> {
  const matches = answers1.filter((a, i) => a === answers2[i]).length;
  const score = Math.round((matches / questions.length) * 100);

  const prompt = `Évaluer la compatibilité d'un couple sur la base de leurs réponses à un quiz.
  Ils ont eu ${matches} réponses identiques sur ${questions.length} questions.
  Score final: ${score}%.
  Fais une analyse brève et ludique en français de leur relation.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });

    return {
      score,
      analysis: response.text || "Analyse indisponible."
    };
  } catch (e) {
    logToErrorFile(e, "GEMINI_EVALUATE");
    return {
      score,
      analysis: "Impossible de générer l'analyse pour le moment."
    };
  }
}
