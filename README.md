# 💖 Cœur à Cœur — Love Sync

**Cœur à Cœur** est une application web mobile ultra-responsive et interactive conçue pour tester la complicité et la compatibilité amoureuse des couples à travers des quiz personnalisés générés par l'IA et synchronisés en temps réel.

---

## 📱 Fonctionnalités Principales

### 1. 🤖 Quiz Personnalisés par l'IA (Gemini)
*   **Thématiques au choix :** Choisissez parmi nos préréglages adaptés à vos envies (*Voyages*, *Cuisine*, *Popcorn/Séries*, *Profond*, *Quotidien*, ou le fameux thème *Coquin*) ou définissez des mots-clés entièrement libres.
*   **Niveaux d'ambiance :** Ajustez le ton avec trois modes de jeu (*Câlin/Simple*, *Passion/Séduisant*, *Fusion/Intime*).
*   **Longueur variable :** Choisissez la durée de votre session avec des quiz de 3, 5, 8 ou 10 questions.

### 2. ⚡ Synchronisation en Temps Réel (Firebase)
*   **Code de session unique :** Génération instantanée d'un code secret à 4 chiffres à partager.
*   **Rejoindre en direct :** Un partenaire peut rejoindre instantanément la partie via le code ou un lien direct dynamique.
*   **Progression simultanée :** Suivez la progression de votre partenaire en direct (s'il réfléchit ou s'il a déjà répondu) pour une expérience rythmée.

### 3. 💬 Communication & Partage Intégrés
*   **Partage Instantané :** Modules de partage immédiat optimisés pour **WhatsApp**, **SMS** ou copier-coller classiques avec détection intelligente des capacités natives mobiles (`navigator.share`).
*   **Chat Intégré :** Un espace de discussion sécurisé en direct sous forme d'onglets pour débriefer, rigoler ou réagir aux questions en cours de route.
*   **Notifications d'abandon :** Si un joueur quitte ou ferme la session, le partenaire restant est immédiatement alerté du départ en temps réel afin de ne pas bloquer son interface.

### 4. 📊 Verdict & Analyse de Compatibilité
*   **Score d'osmose :** Un indicateur visuel animé représentant votre taux de synchronisation.
*   **Analyse de l'IA :** Un verdict textuel rédigé sur-mesure par l'IA pour évaluer vos points communs et vos originalités.
*   **Détail question par question :** Comparez vos réponses sous forme de cartes d'analyse côte à côte pour identifier les zones de parfaite osmose (💚) ou d'irremplaçable singularité (🧩).

---

## 🛠️ Stack Technique

*   **Frontend :** React 19, TypeScript, **Tailwind CSS** (design d'une interface mobile immersive type "poker app/tchat"), et **Motion/React** (animations et transitions fluides entre questions et onglets).
*   **AI Engine :** `@google/genai` (modèle Gemini) pour la génération créative des quiz et l'évaluation personnalisée de la compatibilité.
*   **Base de Données / Backend :** Firebase Firestore & Firebase Auth (Authentification Google sécurisée et base de données réactive temps réel).
*   **Build & Compilateur :** Vite.

---

## 🚀 Lancement & Installation

1. Installez les dépendances :
   ```bash
   npm install
   ```

2. Configurez les secrets de développement dans le panneau AI Studio ou renommez `.env.example` en `.env` en y intégrant vos clés API :
   * `GEMINI_API_KEY`
   * `APP_URL`

3. Démarrez l'application en mode local :
   ```bash
   npm run dev
   ```
