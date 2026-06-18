import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Helper to get Gemini AI Client
function getAIClient(customApiKey?: string) {
  const apiKey = (customApiKey && customApiKey.trim()) || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Aucune clé API Gemini n'a été détectée. Veuillez saisir votre propre clé API Gemini ou configurer l'environnement.");
  }
  return new GoogleGenAI({ apiKey });
}

async function startServer() {
  const app = express();
  const PORT = 3000;
  const LOG_FILE = path.join(process.cwd(), "error.log");

  app.use(express.json());

  // API Route for logging errors from client
  app.post("/api/log-error", (req, res) => {
    const { error, context, timestamp } = req.body;
    const logEntry = `[${timestamp}] [${context}] ERROR: ${JSON.stringify(error)}\n`;
    
    fs.appendFile(LOG_FILE, logEntry, (err) => {
      if (err) console.error("Failed to write to error.log", err);
    });
    
    res.status(200).send({ status: "logged" });
  });

  // API route to generate Quiz QCM via Gemini
  app.post("/api/generate-quiz", async (req, res) => {
    const { topic, count, difficulty, customApiKey, geminiModel, qcmGoal } = req.body;

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
      const modelToUse = (geminiModel && geminiModel.trim()) || "gemini-2.5-flash";
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
      res.json(JSON.parse(text));
    } catch (e: any) {
      console.error("Gemini quiz generation failed:", e);
      let errMsg = e.message || "Erreur de communication avec l'IA Gemini.";
      if (errMsg.includes("PERMISSION_DENIED") || errMsg.includes("403")) {
        errMsg = "Accès refusé par l'API Gemini. Si votre clé d'API par défaut n'est pas autorisée, veuillez configurer votre propre clé API valide dans votre profil.";
      }
      res.status(500).json({ error: errMsg });
    }
  });

  // API route to evaluate compatibility verdict via Gemini
  app.post("/api/evaluate-compatibility", async (req, res) => {
    const {
      answers1,
      answers2,
      questions,
      customApiKey,
      geminiModel,
      player1Name,
      player1Gender,
      player2Name,
      player2Gender,
      qcmGoal,
    } = req.body;

    const matches = (answers1 || []).filter((a: number, i: number) => a === (answers2 || [])[i]).length;
    const score = Math.round((matches / (questions || []).length) * 100);

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
    for (let i = 0; i < (questions || []).length; i++) {
      const q = questions[i];
      const ans1Idx = (answers1 || [])[i];
      const ans2Idx = (answers2 || [])[i];
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
    - Réponses identiques : ${matches} sur ${(questions || []).length} questions
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
      const modelToUse = (geminiModel && geminiModel.trim()) || "gemini-2.5-flash";
      const response = await ai.models.generateContent({
        model: modelToUse,
        contents: prompt,
      });

      res.json({
        score,
        analysis: response.text || "Analyse indisponible."
      });
    } catch (e: any) {
      console.error("Gemini evaluation failed:", e);
      let errMsg = e.message || "Erreur lors de la génération de l'analyse.";
      if (errMsg.includes("PERMISSION_DENIED") || errMsg.includes("403")) {
        errMsg = "Clé API Gemini invalide ou non autorisée. Veuillez saisir votre propre clé API Gemini valide dans votre profil.";
      }
      res.status(500).json({ error: errMsg });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(console.error);
