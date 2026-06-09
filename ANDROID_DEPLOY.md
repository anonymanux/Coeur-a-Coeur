# 🤖 Guide Déploiement Android & Intégration Google Auth avec Capacitor

Ce guide explique étape par étape comment packager l'application **Cœur à Cœur** pour Android au moyen de **Capacitor**, et comment configurer **Firebase** et **Google Auth** pour que l'authentification fonctionne de manière native et sécurisée sur un appareil mobile Android.

---

## 📋 Table des Matières
1. [Prérequis](#1-prérequis)
2. [Étape 1 : Installation et Initialisation de Capacitor](#étape-1--installation-et-initialisation-de-capacitor)
3. [Étape 2 : Configuration de Capacitor (`capacitor.config.json`)](#étape-2--configuration-de-capacitor-capacitorconfigjson)
4. [Étape 3 : Build du projet et Synchronisation native](#étape-3--build-du-projet-et-synchronisation-native)
5. [Étape 4 : Configuration dans la console Firebase (Crucial pour Google Auth)](#étape-5--configuration-dans-la-console-firebase-crucial-pour-google-auth)
6. [Étape 5 : Intégration Native de Google Auth (Capacitor)](#étape-6--intégration-native-de-google-auth-capacitor)
7. [Étape 6 : Compiler et Développer en local](#étape-7--compiler-et-développer-en-local)
8. [Étape 7 : Configuration des Liens Profonds (App Links - love.horarium.net)](#étape-8--configuration-des-liens-profonds-app-links---lovehorariumnet)

---

## 1. Prérequis

Avant de commencer, assures-toi d'avoir installé sur ta machine :
*   **Node.js** (v18+)
*   **Android Studio** avec le SDK de la version Android ciblée.
*   Un **compte console Firebase** actif sur ton projet `ecobusiness-1197f` (ou le projet de production cible).

---

## Étape 1 : Installation et Initialisation de Capacitor

Dans le répertoire racine de ton projet web, installe les dépendances nécessaires pour Capacitor :

```bash
# Installer le cœur de Capacitor et la CLI
npm install @capacitor/core @capacitor/cli

# Initialiser la configuration globale de Capacitor
npx cap init "Cœur à Cœur" "com.coeuracoeur.app" --web-dir=dist
```
*   `"Cœur à Cœur"`: Le nom d'affichage de ton application mobile.
*   `"com.coeuracoeur.app"`: L'identifiant de package (Package ID / Application ID) unique. **Cette valeur est essentielle pour la suite dans la console Firebase**.
*   `--web-dir=dist`: Indique à Capacitor où se trouve le dossier d'export statique généré après le build de ton app React (`npm run build`).

Installe ensuite la plateforme native Android :

```bash
# Installer le module Android Capacitor
npm install @capacitor/android

# Ajouter le dossier natif android au projet
npx cap add android
```

---

## Étape 2 : Configuration de Capacitor (`capacitor.config.ts` ou `.json`)

Modifie ton fichier de configuration capacitor (probablement `capacitor.config.ts`) afin d'y ajouter les configurations d'authentification native et de définir correctement les serveurs de ressources.

E.g. Exemple de `capacitor.config.ts` :

```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.coeuracoeur.app',
  appName: 'Cœur à Cœur',
  webDir: 'dist',
  bundledWebRuntime: false,
  plugins: {
    GoogleAuth: {
      // Ce Client ID Web sera fourni par la console Google Cloud de Firebase (voir Étape 4)
      scopes: ['profile', 'email'],
      serverClientId: 'VOTRE_CLIENT_ID_WEB_FIREBASE.apps.googleusercontent.com',
      forceCodeForRefreshToken: true,
    },
  },
};

export default config;
```

---

## Étape 3 : Build du projet et Synchronisation native

Chaque fois que tu modifies ton code d'interface graphique React et que tu veux tester sur ton émulateur ou téléphone Android, suis ce cycle de commande :

```bash
# 1. Compiler l'application React vers le dossier dist
npm run build

# 2. Copier les ressources compilées et mettre à jour les plug-ins natifs Android
npx cap sync
```

---

## Étape 4 : Configuration dans la console Firebase (Crucial pour Google Auth)

C'est l'étape la plus critique. Par défaut, la commande Firebase `signInWithPopup(auth, provider)` ne fonctionne pas de façon transparente à l'intérieur de la WebView native d'Android sans ces configurations spécifiques :

### A. Récupérer l'empreinte SHA-1 de ton application de développement
Le SDK d'authentification Google a besoin d'identifier de manière unique ta clé de signature d'application mobile pour l'associer à ton application Firebase.

1.  Ouvre ton dossier d'application Android dans ton terminal de développement local :
    ```bash
    cd android
    ```
2.  Génère le rapport des clés de signature de build local :
    *   **Mac/Linux :** `./gradlew signingReport`
    *   **Windows :** `gradlew signingReport`
3.  Dans l'output, cherche le bloc correspondant à la configuration `:app:signingReport` section **debug** ou **release** et copie la chaîne intitulée **SHA-1** (ressemblant à `XX:XX:XX:XX:XX...`).

*Note : Conserve également la chaîne **SHA-256** au cas où.*

### B. Enregistrer l'application Android dans la Console Firebase
1.  Vas sur la page de ta [Console Firebase](https://console.firebase.google.com/).
2.  Sélectionne ton projet.
3.  Clique sur l'engrenage (Aperçu du projet) -> **Paramètres du projet**.
4.  Dans l'onglet **Général**, fais défiler jusqu'à la section **Vos applications**.
5.  Clique sur **Ajouter une application** et choisis le logo **Android**.
6.  Renseigne :
    *   **Nom du package Android :** `com.coeuracoeur.app` (doit être STRICTEMENT identique à ton `appId` dans `capacitor.config.ts`).
    *   **Pseudo de l'application :** Cœur à Cœur Android.
    *   **Certificat de signature SHA-1 :** Colle ici l'empreinte SHA-1 copiée au paragraphe A.
7.  Clique sur **Suivant / Enregistrer** et télécharge le fichier **`google-services.json`**.
8.  Déplace ce fichier `google-services.json` à cet endroit précis de ton projet :
    `[CHEMIN_DE_TON_PROJET]/android/app/google-services.json`.

### C. Récupérer le Client ID Web pour Capacitor
Google Sign-In natif utilise le flux d'identification OAuth d'un Client Web pour s'interfacer avec Firebase Auth :
1.  Dans la console Firebase, retourne dans **Paramètres du projet** -> onglet **Authentification** (ou via la console Google Cloud).
2.  Copie l'identifiant Client Web généré sous le nom de **ID client Web** (elle ressemble à `xxxxxxxx-xxxxxxxx.apps.googleusercontent.com`).
3.  Reporte cette valeur exacte dans ton fichier `capacitor.config.ts` sous la clé `plugins.GoogleAuth.serverClientId`.

---

## Étape 5 : Intégration Native de Google Auth (Capacitor)

La méthode standard de Firebase Web `signInWithPopup` peut être bloquée par Android. Il est fortement recommandé d'utiliser le module officiel de la communauté Capacitor pour intercepter et gérer l'authentification native de manière fluide.

### A. Installer le Plugin Native Google Auth
```bash
npm install @capacitor-community/google-auth
npx cap update
```

### B. Mettre à jour `android/app/src/main/AndroidManifest.xml` (Si requis)
Pour que l'application reçoive proprement le jeton OAuth de l'application Google Play Services, tu dois t'assurer que les clés d'identification sont déclarées au niveau Android.

Sous la balise `<application>` du fichier `android/app/src/main/AndroidManifest.xml` (vérifie s'il existe après l'intégration), le plugin Capacitor d'authentification Google va lier les services configurés automatiquement via le fichier `google-services.json`.

### C. Adapter ton code d'authentification React (`src/components/MainApp.tsx`)

Afin de supporter simultanément la version Web (pour l'aperçu dans l'iframe du navigateur ou site web hébergé) et la version Native Android (au sein de l'application packagée), met à jour la fonction de connexion comme suit :

```typescript
import { GoogleAuth } from '@capacitor-community/google-auth';
import { Capacitor } from '@capacitor/core';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';

const handleLogin = async () => {
  try {
    if (Capacitor.isNativePlatform()) {
      // --- LOGIQUE MOBILE NATIVE (Capacitor) ---
      // Lance l'interface native de sélection du compte Google de l'appareil Android
      const result = await GoogleAuth.signIn();
      const credential = GoogleAuthProvider.credential(result.authentication.idToken);
      
      // Se connecter à Firebase au moyen du Jeton d'identifiant d'appareil natif
      const userCredential = await signInWithCredential(auth, credential);
      const user = userCredential.user;

      // Enregistrer les détails de l'utilisateur dans Firestore
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        await setDoc(userRef, {
          uid: user.uid,
          displayName: user.displayName,
          photoURL: user.photoURL,
          createdAt: serverTimestamp(),
        });
      }
    } else {
      // --- LOGIQUE NAVIGATEUR CLASSIQUE (Popup) ---
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const userRef = doc(db, "users", result.user.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        await setDoc(userRef, {
          uid: result.user.uid,
          displayName: result.user.displayName,
          photoURL: result.user.photoURL,
          createdAt: serverTimestamp(),
        });
      }
    }
  } catch (e) {
    console.error("Erreur lors de l'authentification Google :", e);
  }
};
```

---

## Étape 6 : Compiler et Développer en local

Pour démarrer et déboguer directement le projet depuis ton appareil Android ou ton émulateur :

```bash
# Lancer Android Studio sur ton répertoire mobile
npx cap open android
```

Une fois Android Studio ouvert :
1.  Connecte ton téléphone Android physique en mode **Débogage USB** ou démarre un émulateur.
2.  Clique sur le bouton vert **Run app** (ou `Ctrl+R`) en haut de l'interface Android Studio.
3.  Tu pourras voir tes logs JavaScript mobiles en direct dans la console de l'inspecteur Chrome en ouvrant `chrome://inspect` sur ton ordinateur de bureau, puis en cliquant sur "Inspect" sous la session active de ton téléphone.

---

## Étape 7 : Configuration des Liens Profonds (App Links - `love.horarium.net`)

Pour que les utilisateurs qui cliquent sur une invitation comme `https://love.horarium.net/?join=1234` soient redirigés **directement dans l'application native Android** (sans passer par le navigateur mobile) et que l'application charge automatiquement la session en question, vous devez configurer les **App Links Android (Verified App Links)**.

### A. Déclaration de l'Intent Filter dans l'application native (XML)

Vous devez indiquer au système Android que votre application est capable d'intercepter les liens web pointant vers `love.horarium.net`.

1. Ouvre le fichier situé à : `android/app/src/main/AndroidManifest.xml`
2. Cherche la balise principale `<activity>` (qui contient l'activité de lancement principal, généralement celle ayant la classe `.MainActivity`).
3. Ajoute le bloc `<intent-filter>` suivant à l'intérieur de cette balise `<activity>` :

```xml
<!-- Intercepter l'URL Web love.horarium.net pour rediriger directement dans l'app -->
<intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    
    <!-- Définir le protocole d'interception (exclusivement HTTPS sécurisé) -->
    <data android:scheme="https" android:host="love.horarium.net" />
</intent-filter>

<!-- Optionnel: Permettre d'intercepter un schéma d'URL personnalisé unique -->
<intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="coeuracoeur" />
</intent-filter>
```
*   `android:autoVerify="true"`: Demande au système Android de vérifier l'association de domaine immédiatement lors de l'installation de l'appareil (via le fichier `.well-known/assetlinks.json` hébergé sur votre site).

---

### B. Configuration de la preuve de propriété (Digital Asset Links)

Pour que la redirection automatique (`autoVerify`) fonctionne, Android exige que vous prouviez que vous êtes bien le propriétaire du site `love.horarium.net`. Si cette étape n'est pas faite, l'utilisateur verra un sélecteur "Ouvrir avec Chrome ou Cœur à Cœur" au lieu d'ouvrir directement l'application.

1. Générez l'empreinte **SHA-256** de votre signature d'application (au format Hexadécimal majuscule), soit par la commande `./gradlew signingReport` (durant le développement), soit depuis l'onglet de signature de votre compte de développeur dans l'interface Google Play Console.
2. Créez un fichier texte nommé **`assetlinks.json`** ayant le contenu suivant :

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.coeuracoeur.app",
      "sha256_cert_fingerprints": [
        "VOTRE_SHA256_FINGERPRINT_MAJUSCULE_ICI"
      ]
    }
  }
]
```
*(Remplacez `VOTRE_SHA256_FINGERPRINT_MAJUSCULE_ICI` par votre empreinte SHA-256 réelle).*

3. Téléversez ce fichier sur votre serveur web à cette adresse précise :
   `https://love.horarium.net/.well-known/assetlinks.json`

> **Note de Prod :**
> * Le serveur doit impérativement utiliser le protocole **HTTPS** sécurisé.
> * Le fichier doit être servi avec le type de contenu HTTP `application/json`.
> * La redirection ne s'activera qu'une fois qu'Android aura validé ce fichier lors du premier démarrage/installation de l'application sur le téléphone.

---

### C. Comment cela fonctionne dans le code de l'App ?

Dans le code de notre application (`src/components/MainApp.tsx`), nous avons déjà configuré l'écouteur d'événements Capacitor pour intercepter l'ouverture :

```typescript
// Ce code dans MainApp.tsx intercepte l'événement de redirection natif
useEffect(() => {
  if (Capacitor.isNativePlatform()) {
    // Écoute les lancements ou retours au premier plan par URL de clic
    App.addListener('appUrlOpen', (event: any) => {
      try {
        const rawUrl = event.url; // Contient p.ex. https://love.horarium.net/?join=1234
        const urlString = rawUrl.replace('coeuracoeur://', 'https://');
        const url = new URL(urlString);
        
        const joinCode = url.searchParams.get("join");
        const sessionCode = url.searchParams.get("session");
        
        if (joinCode) {
          // Renseigne automatique l'ID dans l'onglet de saisie du Lobby
          window.dispatchEvent(new CustomEvent("app-join-link", { detail: joinCode }));
        }
        if (sessionCode) {
          setActiveSessionId(sessionCode);
        }
      } catch (e) {
        console.error('Erreur deep-linking:', e);
      }
    });
  }
}, []);
```

Cela garantit une expérience utilisateur incroyablement fluide pour tous ceux qui partagent ou reçoivent des quiz amoureux sur mobile !
