import { GoogleGenAI, Type } from "@google/genai";
import { logToErrorFile } from "../lib/logger";

const DEFAULT_API_KEY = process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY;

if (!DEFAULT_API_KEY) {
  logToErrorFile("GEMINI_API_KEY is missing", "CONFIG_CHECK");
}

function getAIClient(customApiKey?: string) {
  const apiKey = customApiKey?.trim() || DEFAULT_API_KEY;
  if (!apiKey) {
    throw new Error("Aucune clé API Gemini n'a été configurée. Veuillez ajouter votre propre clé API Gemini dans votre profil.");
  }
  return new GoogleGenAI({ apiKey });
}

export interface QuizQuestion {
  text: string;
  options: string[];
  correctAnswer: number;
  category: string;
}
//////////////////////////////////////////
export async function generateQuizQuestions(
  topic: string,
  count: number,
  difficulty: string,
  customApiKey?: string
): Promise<QuizQuestion[]> {
  const prompt = `Générer un quiz de compatibilité amoureuse sur le thème "${topic}". 
  Nombre de questions: ${count}. 
  Difficulté: ${difficulty}.
  Les questions doivent être amusantes et révélatrices sur les préférences ou la personnalité des partenaires.`;

  try {
    const ai = getAIClient(customApiKey);
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
  } catch (e: any) {
    logToErrorFile(e, "GEMINI_GENERATE_QUIZ");
    console.error("Failed to generate or parse Gemini response", e);
    throw new Error(e.message || "Impossible d'interroger Gemini. Veuillez vérifier votre clé API.");
  }
}

export async function evaluateCompatibility(
  answers1: number[],
  answers2: number[],
  questions: QuizQuestion[],
  customApiKey?: string
): Promise<{ score: number; analysis: string }> {
  const matches = answers1.filter((a, i) => a === answers2[i]).length;
  const score = Math.round((matches / questions.length) * 100);

  const prompt = `Évaluer la compatibilité d'un couple sur la base de leurs réponses à un quiz.
  Ils ont eu ${matches} réponses identiques sur ${questions.length} questions.
  Score final: ${score}%.
  Fais une analyse brève et ludique en français de leur relation.`;

  try {
    const ai = getAIClient(customApiKey);
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });

    return {
      score,
      analysis: response.text || "Analyse indisponible."
    };
  } catch (e: any) {
    logToErrorFile(e, "GEMINI_EVALUATE");
    return {
      score,
      analysis: `Impossible de générer l'analyse : ${e.message || "Vérifiez votre clé API Gemini dans votre profil."}`
    };
  }
}
