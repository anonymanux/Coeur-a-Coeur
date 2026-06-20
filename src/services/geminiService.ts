import { GoogleGenAI, Type } from "@google/genai";
import { logToErrorFile } from "../lib/logger";

export interface QuizQuestion {
  text: string;
  options: string[];
  correctAnswer: number;
  category: string;
}

// Helper to get GoogleGenAI client on the client-side
function getAIClient(customApiKey?: string) {
  // Use user's custom API key or fallback to the compiled process.env.GEMINI_API_KEY
  const apiKey = (customApiKey && customApiKey.trim()) || (process.env as any).GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Aucune clé API Gemini n'a été détectée. Veuillez saisir votre propre clé API Gemini dans votre profil.");
  }
  return new GoogleGenAI({ apiKey });
}

export async function generateQuizQuestions(
  topic: string,
  count: number,
  difficulty: string,
  customApiKey?: string,
  geminiModel?: string,
  qcmGoal?: "monsieur" | "madame" | "standard"
): Promise<QuizQuestion[]> {
  let goalContext = "";
  if (qcmGoal === "monsieur") {
    goalContext = "L'objectif unique de ce QCM est d'APPRENDRE À CONNAÎTRE MONSIEUR (l'homme du couple). Les questions doivent donc porter spécifiquement sur les goûts, habitudes, préférences, réactions et secrets d'un homme au sein du couple, pour voir si sa partenaire / son partenaire le connaît sur le bout des doigts.";
  } else if (qcmGoal === "madame") {
    goalContext = "L'objectif unique de ce QCM est d'APPRENDRE À CONNAÎTRE MADAME (la femme du couple). Les questions doivent donc porter spécifiquement sur les goûts, habitudes, sentiments, réactions ou préférences d'une femme au sein du couple, pour tester s'il/elle la connaît parfaitement.";
  } else {
    goalContext = "L'objectif de ce QCM est un test standard de complicité et de compatibilité de préférences amoureuses générales au sein du couple (cinéma, sorties, style de vie, valeurs, etc.).";
  }

  const prompt = `Générer un quiz de compatibilité amoureuse sur le thème "${topic}". 
  Nombre de questions: ${count}. 
  Difficulté: ${difficulty}.
  
  But éducatif et ludique du QCM : ${goalContext}
  
  Les questions et propositions de réponses (QCM) doivent être amusantes, complices, subtiles et révélatrices.`;

  try {
    const ai = getAIClient(customApiKey);
    const modelToUse = geminiModel?.trim() || "gemini-2.5-flash";
    const response = await ai.models.generateContent({
      model: modelToUse,
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
              correctAnswer: { type: Type.INTEGER, description: "Index de la réponse idéale pour le profil ou une option de référence" },
              category: { type: Type.STRING }
            },
            required: ["text", "options", "correctAnswer", "category"]
          }
        }
      }
    });

    const text = response.text || "[]";
    return JSON.parse(text);
  } catch (e: any) {
    logToErrorFile(e, "GEMINI_GENERATE_QUIZ");
    console.error("Failed to generate or parse Gemini response", e);
    
    let errMsg = e.message || "Erreur de communication avec l'IA Gemini.";
    if (errMsg.includes("PERMISSION_DENIED") || errMsg.includes("403")) {
      errMsg = "Accès refusé par l'API Gemini. Si votre clé d'API par défaut n'est pas autorisée, veuillez configurer votre propre clé API valide dans votre profil.";
    }
    throw new Error(errMsg);
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
  const matches = answers1.filter((a, i) => a === answers2[i]).length;
  const score = Math.round((matches / questions.length) * 100);

  const player1Label = `${player1Name || "Joueur 1"}${player1Gender ? ` (Sexe : ${player1Gender})` : ""}`;
  const player2Label = `${player2Name || "Joueur 2"}${player2Gender ? ` (Sexe : ${player2Gender})` : ""}`;

  let goalExplanation = "";
  if (qcmGoal === "monsieur") {
    goalExplanation = "Ce quiz avait pour but spécifique d'apprendre à connaître Monsieur (l'homme du couple). Le score reflète la connaissance qu'a le partenaire des préférences et de la personnalité de Monsieur.";
  } else if (qcmGoal === "madame") {
    goalExplanation = "Ce quiz avait pour but spécifique d'apprendre à connaître Madame (la femme du couple). Le score reflète la connaissance qu'a le partenaire des préférences et de la personnalité de Madame.";
  } else {
    goalExplanation = "Ce quiz était un test standard de compatibilité amoureuse pour comparer leurs préférences et styles de vie mutuels.";
  }

  let detailsText = "";
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const ans1Idx = answers1[i];
    const ans2Idx = answers2[i];
    const ans1Text = q.options[ans1Idx] || "Non répondu";
    const ans2Text = q.options[ans2Idx] || "Non répondu";
    const isMatched = ans1Idx === ans2Idx;

    detailsText += `Question ${i + 1} : ${q.text}\n`;
    detailsText += `- ${player1Name || "Créateur"} a choisi : "${ans1Text}"\n`;
    detailsText += `- ${player2Name || "Partenaire"} a choisi : "${ans2Text}"\n`;
    detailsText += `- Résultat : ${isMatched ? "ACCORD ✔" : "DISSENSION / DIFFÉRENCE ❌"}\n\n`;
  }

  const prompt = `Évaluer la compatibilité de ce couple sur la base de leurs réponses au quiz.
  
  Profils des joueurs :
  - Joueur 1 (Créateur) : ${player1Label}
  - Joueur 2 (Partenaire) : ${player2Label}
  
  Statistiques du quiz :
  - Score global de complicité : ${score}%
  - Réponses identiques : ${matches} sur ${questions.length} questions
  - Objectif initial du quiz : ${goalExplanation}
  
  Détail du test et choix effectués question par question :
  ${detailsText}
  
  Tes instructions de rédaction pour le verdict final :
  1. Adresse-toi DIRECTEMENT et très PERSONNELLEMENT aux deux joueurs en les interpellant par leurs pseudos (${player1Name || "Joueur 1"} et ${player2Name || "Joueur 2"}).
  2. Fais une analyse amusante, complice, chaleureuse et pleine de bienveillance de leur relation.
  3. Prends bien en compte leurs genres respectifs (${player1Gender || "non précisé"} et ${player2Gender || "non précisé"}) pour adapter tes remarques et conseils de façon pertinente et ludique.
  4. Analyse de façon spécifique un ou deux choix concordants ou divergents à partir de la liste des questions ci-dessus. Donne-leur des conseils amoureux drôles et ultra-précis pour mieux comprendre les attentes de l'autre, approfondir leur lien, ou tout simplement chérir leurs petites différences !
  5. Structure ton texte avec des paragraphes aérés, des émojis complices et un style agréable à lire. Fais des phrases fluides et stimulantes.`;

  try {
    const ai = getAIClient(customApiKey);
    const modelToUse = geminiModel?.trim() || "gemini-2.5-flash";
    const response = await ai.models.generateContent({
      model: modelToUse,
      contents: prompt,
    });

    return {
      score,
      analysis: response.text || "Analyse indisponible."
    };
  } catch (e: any) {
    logToErrorFile(e, "GEMINI_EVALUATE");
    let errMsg = e.message || "Erreur de communication avec l'IA Gemini.";
    if (errMsg.includes("PERMISSION_DENIED") || errMsg.includes("403")) {
      errMsg = "Clé API Gemini invalide ou non autorisée. Veuillez saisir votre propre clé API Gemini valide dans votre profil.";
    }
    return {
      score,
      analysis: `Impossible de générer l'analyse : ${errMsg}`
    };
  }
}
