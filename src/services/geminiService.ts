import { logToErrorFile } from "../lib/logger";

export interface QuizQuestion {
  text: string;
  options: string[];
  correctAnswer: number;
  category: string;
}

export async function generateQuizQuestions(
  topic: string,
  count: number,
  difficulty: string,
  customApiKey?: string,
  geminiModel?: string,
  qcmGoal?: "monsieur" | "madame" | "standard"
): Promise<QuizQuestion[]> {
  try {
    const response = await fetch("/api/generate-quiz", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        topic,
        count,
        difficulty,
        customApiKey,
        geminiModel,
        qcmGoal
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const message = errData.error || `Erreur serveur (${response.status})`;
      throw new Error(message);
    }

    return await response.json();
  } catch (e: any) {
    logToErrorFile(e, "GEMINI_GENERATE_QUIZ");
    console.error("Failed to generate or parse Gemini response", e);
    throw new Error(e.message || "Impossible d'interroger Gemini (vérifiez la console serveur ou votre clé d’API).");
  }
}

export async function evaluateCompatibility(
  answers1: number[],
  answers2: number[],
  questions: QuizQuestion[],
  customApiKey?: string,
  geminiModel?: string,
  player1Name?: string,
  player1Gender?: "Homme" | "Femme" | "",
  player2Name?: string,
  player2Gender?: "Homme" | "Femme" | "",
  qcmGoal?: "monsieur" | "madame" | "standard"
): Promise<{ score: number; analysis: string }> {
  try {
    const response = await fetch("/api/evaluate-compatibility", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        answers1,
        answers2,
        questions,
        customApiKey,
        geminiModel,
        player1Name,
        player1Gender,
        player2Name,
        player2Gender,
        qcmGoal
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const message = errData.error || `Erreur serveur (${response.status})`;
      throw new Error(message);
    }

    return await response.json();
  } catch (e: any) {
    logToErrorFile(e, "GEMINI_EVALUATE");
    const matches = (answers1 || []).filter((a, i) => a === (answers2 || [])[i]).length;
    const score = Math.round((matches / (questions || []).length) * 100);
    return {
      score,
      analysis: `Impossible de générer l'analyse : ${e.message || "Erreur inconnue."}`
    };
  }
}
