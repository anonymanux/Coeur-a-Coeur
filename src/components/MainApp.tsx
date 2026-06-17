import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { auth, db, handleFirestoreError, OperationType } from "../lib/firebase";
import { GoogleAuthProvider, signInWithCredential, signInWithPopup, signOut } from "firebase/auth";
import { doc, getDoc, setDoc, onSnapshot, collection, query, orderBy, limit, addDoc, updateDoc, where, getDocs, serverTimestamp } from "firebase/firestore";
import { Heart, MessageCircle, Settings, Users, LogOut, Send, Play, UserPlus, ChevronRight, Copy, Check, Sparkles, RefreshCw, ThumbsUp, AlertCircle, Compass, Share2, MessageSquare } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { generateQuizQuestions, QuizQuestion, evaluateCompatibility } from "../services/geminiService";
import { cn } from "../lib/utils";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { StatusBar, Style } from "@capacitor/status-bar";
import { GoogleSignIn } from "@capawesome/capacitor-google-sign-in";

export function MainApp() {
  const { user } = useAuth();
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Parse URL search params for direct join codes
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionToJoin = params.get("session");
    if (sessionToJoin) {
      setActiveSessionId(sessionToJoin);
    }
  }, []);


  // Handle native deep linking for Capacitor
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      const setupDeepLink = async () => {
        App.addListener('appUrlOpen', (event: any) => {
          try {
            console.log('App opened with URL:', event.url);
            // Translate scheme coeuracoeur:// to https://
            const rawUrl = event.url;
            const urlString = rawUrl.replace('coeuracoeur://', 'https://');
            const url = new URL(urlString);
            
            const joinCode = url.searchParams.get("join");
            const sessionCode = url.searchParams.get("session");
            
            if (joinCode) {
              // Dispatch event for Lobby to pick it up
              window.dispatchEvent(new CustomEvent("app-join-link", { detail: joinCode }));
            }
            if (sessionCode) {
              setActiveSessionId(sessionCode);
            }
          } catch (e) {
            console.error('Error parsing deep link URL:', e);
          }
        });
      };
      
      setupDeepLink();
      
      return () => {
        App.removeAllListeners();
      };
    }
  }, []);

  // Configure Capacitor StatusBar to blend perfectly with the app design (like Flutter)
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      const configureStatusBar = async () => {
        try {
          const { StatusBar, Style } = await import('@capacitor/status-bar');
          
          // 1. Définir la couleur de fond
          await StatusBar.setBackgroundColor({ color: "#FFF5F7" });
          
          // 2. Style light pour les icônes sombres
          await StatusBar.setStyle({ style: Style.Light });
          
          // 3. IMPORTANT: S'assurer que la barre est visible mais ne chevauche pas
          await StatusBar.show();
          
          // 4. Optionnel: Définir les overlays
          // Pour Android, éviter que le contenu passe sous la barre
          if (Capacitor.getPlatform() === 'android') {
            // Ajouter une classe CSS personnalisée
            document.documentElement.classList.add('android-status-bar');
            
            // Ajouter un style global
            const style = document.createElement('style');
            style.textContent = `
              .android-status-bar .min-h-screen {
                padding-top: 24px !important;
              }
              .android-status-bar header {
                padding-top: calc(0.75rem + 24px) !important;
              }
            `;
            document.head.appendChild(style);
          }
        } catch (e) {
          console.warn("Could not configure StatusBar natively:", e);
        }
      };
      configureStatusBar();
    }
  }, []);




  if (!user) {
    return <AuthScreen />;
  }

  return (
    <div className="min-h-screen bg-[#FFF5F7] flex items-center justify-center p-0 sm:p-4 md:p-6 lg:p-8">
      {/* Mobile Frame Simulator for Desktop, Full-Bleed on Real Mobile */}
      <div className="w-full max-w-md bg-white h-screen sm:h-[830px] sm:max-h-[850px] shadow-2xl sm:rounded-[3rem] border-0 sm:border-8 sm:border-slate-900/10 flex flex-col relative overflow-hidden">
        {/* Floating background hearts */}
        <div className="absolute inset-0 pointer-events-none select-none overflow-hidden opacity-40 z-0">
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute text-rose-200 text-xl"
              initial={{ 
                x: Math.random() * 150 - 75, 
                y: 700, 
                opacity: 0.1 + Math.random() * 0.4,
                scale: 0.6 + Math.random() * 0.6 
              }}
              animate={{ 
                y: -100,
                x: `calc(${Math.random() * 100 - 50}px + ${Math.random() * 40 - 20}px)`
              }}
              transition={{ 
                duration: 9 + Math.random() * 7, 
                repeat: Infinity, 
                ease: "linear",
                delay: i * 1.5 
              }}
              style={{ left: `${12 + i * 15}%` }}
            >
              ❤️
            </motion.div>
          ))}
        </div>

        <Header onProfileClick={() => setIsProfileModalOpen(true)} />
        
        <div className="flex-1 overflow-hidden relative z-10 flex flex-col bg-[#FFF5F7]/30">
          <AnimatePresence mode="wait">
            {!activeSessionId ? (
              <Lobby key="lobby" setActiveSessionId={setActiveSessionId} />
            ) : (
              <GameRoom key="game" sessionId={activeSessionId} onLeave={() => setActiveSessionId(null)} />
            )}
          </AnimatePresence>
        </div>

        {/* CSS rules inject */}
        <style>{`
          .custom-scrollbar::-webkit-scrollbar {
            width: 4px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: #f43f5e;
            border-radius: 9999px;
          }
        `}</style>
        
        <UserProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} />
      </div>
    </div>
  );
}

function Header({ onProfileClick }: { onProfileClick: () => void }) {
  const { user, profile } = useAuth();

  const photoURL = profile?.photoURL || user?.photoURL;
  const displayName = profile?.displayName || user?.displayName || "Utilisateur";

  return (
    <header className="flex items-center justify-between bg-white/80 backdrop-blur-md px-6 py-4 shadow-sm border-b border-rose-50 shrink-0 relative z-20">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-rose-500 rounded-lg flex items-center justify-center text-white shadow-md shadow-rose-200 transition-transform active:scale-95">
          <Heart className="w-5 h-5 fill-current" />
        </div>
        <div>
          <h1 className="text-lg font-black tracking-tight text-rose-600 leading-none">Cœur à Cœur</h1>
          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Sync Amoureuse</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div 
          onClick={onProfileClick}
          className="w-8 h-8 rounded-full border border-rose-200 hover:border-rose-400 p-0.5 shadow-sm shrink-0 cursor-pointer active:scale-95 transition-all"
          title="Modifier votre profil et Clé Gemini"
        >
          {photoURL ? (
            <img src={photoURL} alt="" referrerPolicy="no-referrer" className="w-full h-full rounded-full object-cover" />
          ) : (
            <div className="w-full h-full bg-rose-100 rounded-full flex items-center justify-center font-bold text-rose-600 text-xs text-center uppercase">
              {displayName?.[0] || "?"}
            </div>
          )}
        </div>
        <button 
          onClick={() => signOut(auth)}
          className="w-8 h-8 flex items-center justify-center hover:bg-rose-50 rounded-full transition-colors text-slate-400 hover:text-rose-500 active:scale-90"
          title="Se déconnecter"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}

function UserProfileModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { user, profile } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (isOpen && user) {
      setDisplayName(profile?.displayName || user.displayName || "");
      setPhotoURL(profile?.photoURL || user.photoURL || "");
      setGeminiApiKey(profile?.geminiApiKey || "");
      setSaveStatus("idle");
      setErrorMessage("");
    }
  }, [isOpen, profile, user]);

  if (!isOpen || !user) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveStatus("idle");
    setErrorMessage("");
    try {
      const userRef = doc(db, "users", user.uid);
      await setDoc(userRef, {
        displayName: displayName.trim(),
        photoURL: photoURL.trim(),
        geminiApiKey: geminiApiKey.trim(),
        lastUpdatedAt: serverTimestamp(),
      }, { merge: true });

      setSaveStatus("success");
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      console.error("Error saving profile:", err);
      setSaveStatus("error");
      setErrorMessage(err.message || "Une erreur est survenue lors de l'enregistrement.");
    } finally {
      setIsSaving(false);
    }
  };

  const AVATAR_PRESETS = [
    { label: "Cupidon", url: "https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=100&auto=format&fit=crop&q=60" },
    { label: "Cœurs", url: "https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=100&auto=format&fit=crop&q=60" },
    { label: "Cosmique", url: "https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?w=100&auto=format&fit=crop&q=60" },
    { label: "Fleur Rose", url: "https://images.unsplash.com/photo-1526047932273-341f2a7631f9?w=100&auto=format&fit=crop&q=60" },
    { label: "Félin Mignon", url: "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=100&auto=format&fit=crop&q=60" },
    { label: "Panda", url: "https://images.unsplash.com/photo-1508921912186-1d1a45ebb3c1?w=100&auto=format&fit=crop&q=60" }
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop overlay */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-[#331122]/40 backdrop-blur-sm"
        />

        {/* Modal card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: "spring", duration: 0.5 }}
          className="relative w-full max-w-sm bg-white rounded-[2.5rem] shadow-2xl border-4 border-rose-100 p-6 overflow-hidden z-50 flex flex-col"
        >
          {/* Header decor */}
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-rose-200/40 rounded-bl-full pointer-events-none" />
          
          <div className="flex items-center justify-between mb-5 relative z-10">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-500">
                <Settings className="w-5 h-5 animate-spin" style={{ animationDuration: '6s' }} />
              </div>
              <h2 className="text-xl font-black text-rose-600 tracking-tight">Mon Profil</h2>
            </div>
            <button 
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 w-8 h-8 rounded-full hover:bg-slate-50 flex items-center justify-center transition-colors font-bold text-lg"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSave} className="space-y-4 relative z-10 flex-grow overflow-y-auto max-h-[70vh] pr-1 scrollbar-none">
            {/* Display name field */}
            <div>
              <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-2">
                Pseudo / Surnom de couple
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Votre pseudo..."
                className="w-full px-4 py-3 rounded-xl bg-rose-50/50 border border-rose-100 text-slate-800 focus:outline-none focus:border-rose-400 focus:bg-white text-sm font-bold transition-all"
              />
            </div>

            {/* Avatar picker / Photo URL field */}
            <div>
              <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-2">
                Photo de profil (URL)
              </label>
              
              {/* Preview and Input */}
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-full border-2 border-rose-200 p-0.5 overflow-hidden shadow-sm shrink-0 bg-rose-50">
                  {photoURL ? (
                    <img src={photoURL} alt="Preview" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <div className="w-full h-full rounded-full bg-rose-200 flex items-center justify-center font-bold text-rose-600 text-sm">
                      {displayName[0] || "?"}
                    </div>
                  )}
                </div>
                <input
                  type="url"
                  value={photoURL}
                  onChange={(e) => setPhotoURL(e.target.value)}
                  placeholder="Lien d'image (https://...)"
                  className="flex-1 px-3 py-2 border border-rose-100 rounded-lg text-xs font-medium text-slate-600 focus:outline-none focus:border-rose-300"
                />
              </div>

              {/* Preset selection */}
              <div className="bg-rose-50/30 p-2.5 rounded-xl border border-rose-100/55">
                <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wide mb-1.5">
                  Avatars prédéfinis :
                </span>
                <div className="grid grid-cols-6 gap-2">
                  {AVATAR_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setPhotoURL(preset.url)}
                      title={preset.label}
                      className={`w-9 h-9 rounded-full border-2 overflow-hidden shadow-xs hover:scale-110 active:scale-95 transition-all ${
                        photoURL === preset.url ? "border-rose-500 shadow-sm" : "border-transparent"
                      }`}
                    >
                      <img src={preset.url} alt={preset.label} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Gemini API Key field */}
            <div className="pt-2 border-t border-rose-50">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-black text-slate-500 uppercase tracking-wider">
                  Votre Clé API Gemini
                </label>
                <span className="text-[9px] bg-emerald-50 text-emerald-600 font-extrabold px-1.5 py-0.5 rounded-full border border-emerald-100">
                  Optionnel
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium leading-relaxed mb-2.5">
                Utilisez votre propre clé API Gemini pour générer vos quiz et analyses à l'infini !
              </p>
              
              <div className="relative">
                <input
                  type={showKey ? "text" : "password"}
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full pl-4 pr-11 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-none focus:border-rose-400 focus:bg-white text-xs font-mono transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold transition-colors"
                >
                  {showKey ? "Masquer" : "Afficher"}
                </button>
              </div>

              <div className="mt-2.5 flex justify-end">
                <a 
                  href="https://aistudio.google.com/app/apikey" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-[10px] text-rose-500 font-bold hover:underline inline-flex items-center gap-1"
                >
                  Obtenir une clé API gratuite <ChevronRight className="w-3 h-3" />
                </a>
              </div>
            </div>

            {/* Error or Success notification banner */}
            {saveStatus === "success" && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-extrabold flex items-center gap-2 border border-emerald-100"
              >
                <div className="w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center text-white text-[10px]">✓</div>
                Sauvegardé avec succès !
              </motion.div>
            )}

            {saveStatus === "error" && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-red-50 text-red-600 rounded-xl text-xs font-medium border border-red-100"
              >
                {errorMessage}
              </motion.div>
            )}

            {/* Submission button */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={isSaving}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-rose-400 to-rose-500 hover:from-rose-500 hover:to-rose-600 text-white font-black text-sm py-4 rounded-xl shadow-lg shadow-rose-200/80 transition-all text-center mt-4 disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Enregistrement...
                </>
              ) : (
                <>
                  Enregistrer
                </>
              )}
            </motion.button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

function AuthScreen() {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);

  // Initialize Google Sign-In for Capacitor
  useEffect(() => {
    const initializeGoogleSignIn = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          console.log("=========*****========= Initializing Google Sign-In for native platform ===");
          
          const clientId = process.env.VITE_GOOGLE_WEB_CLIENT_ID;
          
          if (!clientId) {
            throw new Error("VITE_GOOGLE_WEB_CLIENT_ID is not defined in environment variables");
          }
          
          console.log("Client ID found:", clientId.substring(0, 30) + "...");
          
          await GoogleSignIn.initialize({
            clientId: clientId,
            scopes: ['profile', 'email'],
          });
          
          console.log("Google Sign-In initialized successfully");
          setIsInitializing(false);
        } catch (error) {
          console.error("Failed to initialize Google Sign-In:", error);
          setInitError("Impossible d'initialiser la connexion Google. Veuillez redémarrer l'application.");
          setIsInitializing(false);
        }
      } else {
        setIsInitializing(false);
      }
    };
    
    initializeGoogleSignIn();
  }, []);

  const handleLogin = async () => {
    // Vérifier si l'initialisation est terminée
    if (isInitializing) {
      setInitError("Initialisation en cours, veuillez patienter...");
      return;
    }

    setIsSigningIn(true);
    setInitError(null);
    
    try {
      let userCredential;
  
      if (Capacitor.isNativePlatform()) {
        console.log("📱 Native platform - attempting Google Sign-In");
        
        try {
          
          
          // Déclencher le flux de connexion
          const result = await GoogleSignIn.signIn();
          console.log("✅ Sign-in result received:", result);
          
          // Extraire l'ID Token (structure correcte pour @capawesome)
          const idToken = result.idToken || (result as any).authentication?.idToken;

          
          if (!idToken) {
            throw new Error("Impossible d'obtenir l'ID Token depuis Google Sign-In");
          }
          
          console.log("🔑 ID Token obtained, creating Firebase credential");
          const credential = GoogleAuthProvider.credential(idToken);
          userCredential = await signInWithCredential(auth, credential);
          
        } catch (error: any) {
          console.error("Google Sign-In error:", error);
          
          // Gérer l'annulation par l'utilisateur (pas une erreur à afficher)
          if (error.code === 'sign_in_canceled' || error.message?.includes('canceled')) {
            console.log("User cancelled sign-in");
            setInitError(null); // Pas d'erreur, juste annulation
            return;
          }
          
          // Gérer l'absence de Google Play Services
          if (error.message?.includes('Google Play services')) {
            setInitError("Google Play Services n'est pas disponible sur cet appareil");
            return;
          }
          
          // Si non initialisé, réessayer une fois
          if (error.message?.includes("not initialized")) {
            console.log("Re-initializing Google Sign-In...");
            const clientId = process.env.VITE_GOOGLE_WEB_CLIENT_ID;
            if (clientId) {
              await GoogleSignIn.initialize({
                clientId: clientId,
                scopes: ['profile', 'email'],
              });
              const result = await GoogleSignIn.signIn();

              const idToken = result.idToken || (result as any).authentication?.idToken;
              if (!idToken) throw new Error("No ID token after re-initialization");
              const credential = GoogleAuthProvider.credential(idToken);
              userCredential = await signInWithCredential(auth, credential);
            } else {
              throw new Error("Client ID missing");
            }
          } else {
            throw error;
          }
        }
      } else {
        // Web platform - utiliser popup au lieu de redirect
        console.log("🌐 Web platform - attempting sign in with popup");
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        userCredential = await signInWithPopup(auth, provider);
      }
  
      const user = userCredential.user;
      console.log("✅ User signed in:", user.email);
  
      // Firestore persistence - créer/update le document utilisateur
      if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) {
          await setDoc(userRef, {
            uid: user.uid,
            displayName: user.displayName || 'Utilisateur',
            email: user.email,
            photoURL: user.photoURL,
            createdAt: serverTimestamp(),
            lastLoginAt: serverTimestamp(),
          });
        } else {
          // Mettre à jour la dernière connexion
          await setDoc(userRef, {
            lastLoginAt: serverTimestamp(),
          }, { merge: true });
        }
      }
      
      console.log("🎉 Authentication and Firestore sync complete:", user.email);
  
    } catch (error: any) {
      console.error("❌ Complete authentication error:", error);
      
      // Messages d'erreur plus spécifiques
      if (error.code === 'auth/popup-blocked') {
        setInitError("Veuillez autoriser les popups pour ce site");
      } else if (error.code === 'auth/unauthorized-domain' || error.message?.includes('auth/unauthorized-domain')) {
        const hostname = window.location.hostname;
        setInitError(
          `Ce domaine (${hostname}) n'est pas autorisé dans votre console Firebase. ` +
          `Veuillez vous rendre dans Firebase Console -> Authentication -> Paramètres (Settings) -> "Domaines d'autorisation" (Authorized Domains) et ajoutez "${hostname}".`
        );
      } else if (error.code === 'auth/network-request-failed') {
        setInitError("Problème de connexion internet. Vérifiez votre réseau.");
      } else if (error.message?.includes('Firebase')) {
        setInitError("Erreur de connexion au service d'authentification");
      } else if (error.message?.includes('SHA-1')) {
        setInitError("Erreur de configuration : Empreinte SHA-1 manquante dans Firebase Console");
      } else if (error.message?.includes('client ID') || error.message?.includes('Client ID')) {
        setInitError("Erreur de configuration : Client ID Google invalide");
      } else {
        setInitError(error.message || "Une erreur est survenue lors de la connexion");
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  // Afficher un écran de chargement pendant l'initialisation sur native
  if (isInitializing && Capacitor.isNativePlatform()) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#FFF5F7]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        >
          <Heart className="w-16 h-16 text-rose-400 fill-rose-200" />
        </motion.div>
        <p className="mt-6 text-rose-500 font-medium">Initialisation...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center p-6 bg-[#FFF5F7] relative overflow-hidden">
      {/* Animated background stars */}
      <div className="absolute inset-0 pointer-events-none select-none opacity-40">
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute text-rose-300"
            initial={{ scale: 0.5, y: 800, opacity: 0.1 }}
            animate={{ y: -100, opacity: [0.1, 0.5, 0.1] }}
            transition={{ 
              duration: 7 + Math.random() * 5, 
              repeat: Infinity, 
              delay: i * 1.2,
              ease: "linear"
            }}
            style={{ left: `${5 + i * 13}%` }}
          >
            ❤️
          </motion.div>
        ))}
      </div>

      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 100 }}
        className="mb-10 relative z-10"
      >
        <div className="w-24 h-24 bg-gradient-to-br from-rose-400 to-rose-500 rounded-[1.8rem] flex items-center justify-center text-white shadow-2xl shadow-rose-200 mx-auto rotate-12 mb-6 relative">
          <Heart className="w-12 h-12 fill-current" />
          <motion.div 
            animate={{ scale: [1, 1.1, 1] }} 
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="absolute -top-1 -right-1 bg-white text-rose-500 rounded-full p-1.5 shadow-md"
          >
            <Sparkles className="w-3.5 h-3.5 fill-current" />
          </motion.div>
        </div>
        <h1 className="text-4xl font-extrabold text-slate-900 mb-3 tracking-tight">Cœur à Cœur</h1>
        <p className="text-slate-500 text-sm max-w-[280px] mx-auto leading-relaxed">
          Testez votre complicité amoureuse grâce à des quiz générés à la volée par notre IA !
        </p>
      </motion.div>

      <motion.button 
        whileTap={{ scale: 0.95 }}
        onClick={handleLogin}
        disabled={isSigningIn}
        className="flex items-center gap-3 bg-white px-8 py-4 rounded-2xl font-bold text-slate-800 shadow-lg shadow-slate-200/60 border border-slate-100 hover:shadow-xl hover:scale-[1.02] transition-all duration-200 group relative z-10 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
      >
        {isSigningIn ? (
          <>
            <div className="w-5 h-5 border-2 border-slate-300 border-t-rose-500 rounded-full animate-spin"></div>
            Connexion en cours...
          </>
        ) : (
          <>
            <svg viewBox="0 0 24 24" className="w-5 h-5 group-hover:rotate-12 transition-transform shrink-0" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
            </svg>
            Se connecter avec Google
          </>
        )}
      </motion.button>

      {initError && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 p-3 bg-red-50 text-red-600 rounded-xl text-sm max-w-[280px] z-10 border border-red-100"
        >
          {initError}
        </motion.div>
      )}
    </div>
  );
}

export default AuthScreen;

const PRESET_THEMES = [
  { icon: "🌶️", label: "Coquin", value: "Désirs, Séduction, Secrets intimes, Fantasmes" },
  { icon: "✈️", label: "Voyages", value: "Voyage, Aventure, Escapade, Logistique de couple" },
  { icon: "🍳", label: "Cuisine", value: "Restaurants, Plats favoris, Partage des repas, Goûts" },
  { icon: "📺", label: "Popcorn", value: "Cinéma, Séries favorites, Soirée cocooning" },
  { icon: "🧠", label: "Profond", value: "Valeurs de vie, Projets d'avenir, Psychologie, Confiance" },
  { icon: "🏡", label: "Quotidien", value: "Vie commune, Habitudes agaçantes, Tâches ménagères" }
];

function Lobby({ setActiveSessionId }: { setActiveSessionId: (id: string) => void }) {
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<"create" | "join">("create");
  const [joinId, setJoinId] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [config, setConfig] = useState({
    topics: "Désirs, Séduction, Secrets intimes",
    count: 5,
    difficulty: "medium" as "easy" | "medium" | "hard"
  });

  // Handle URL redirect query automatically and native deep-links
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("join");
    if (code) {
      setJoinId(code);
      setActiveTab("join");
    }

    const handleJoinLink = (e: Event) => {
      const customCode = (e as CustomEvent).detail;
      if (customCode) {
        setJoinId(customCode);
        setActiveTab("join");
      }
    };

    window.addEventListener("app-join-link", handleJoinLink);
    return () => {
      window.removeEventListener("app-join-link", handleJoinLink);
    };
  }, []);

  const handleCreate = async () => {
    if (!user) return;
    setIsCreating(true);
    setError(null);
    const shortId = Math.floor(1000 + Math.random() * 9000).toString();
    const sessionId = `session_${Date.now()}`;
    
    try {
      const genQuestions = await generateQuizQuestions(config.topics, config.count, config.difficulty, profile?.geminiApiKey);
      
      if (!genQuestions || genQuestions.length === 0) {
        throw new Error("L'IA n'a pas pu générer de questions. Essayez d'autres thèmes.");
      }

      const sessionRef = doc(db, "sessions", sessionId);
      await setDoc(sessionRef, {
        id: shortId,
        creatorId: user.uid,
        status: "waiting",
        config: {
          questionCount: config.count,
          topics: config.topics.split(",").map(t => t.trim()),
          difficulty: config.difficulty
        },
        currentQuestionIndex: 0,
        createdAt: serverTimestamp(),
      });

      const batchPromises = genQuestions.map((q, index) => addDoc(collection(db, `sessions/${sessionId}/questions`), { ...q, order: index }));
      await Promise.all(batchPromises);
      
      setActiveSessionId(sessionId);
    } catch (e: any) {
      console.error("Erreur handleCreate:", e);
      let message = "Une erreur est survenue.";
      if (e instanceof Error) {
        try {
          const parsed = JSON.parse(e.message);
          message = parsed.error || e.message;
        } catch {
          message = e.message;
        }
      }
      setError(message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoin = async () => {
    if (!joinId || !user) return;
    setError(null);
    try {
      const q = query(
        collection(db, "sessions"), 
        where("id", "==", joinId), 
        limit(10)
      );
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        setError("Session non trouvée.");
        return;
      }

      const sessionDoc = querySnapshot.docs.find(d => d.data().status === "waiting");
      
      if (!sessionDoc) {
        setError("Cette session est déjà commencée ou n'existe pas.");
        return;
      }

      const sessionData = sessionDoc.data();
      if (sessionData.creatorId === user.uid) {
        setError("Vous ne pouvez pas rejoindre votre propre session.");
        return;
      }

      await updateDoc(doc(db, "sessions", sessionDoc.id), {
        joinerId: user.uid,
        status: "ongoing",
        updatedAt: serverTimestamp()
      });
      setActiveSessionId(sessionDoc.id);
    } catch (e: any) {
      console.error("Erreur handleJoin:", e);
      setError("Erreur lors de la connexion à la session.");
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-5 flex flex-col justify-between custom-scrollbar">
      <div className="space-y-4">
        {/* Tab Toggle Switch */}
        <div className="bg-rose-100/50 p-1 rounded-2xl flex items-center mb-4">
          <button 
            onClick={() => setActiveTab("create")}
            className={cn(
              "flex-1 py-3 text-xs uppercase tracking-widest font-extrabold rounded-xl transition-all flex items-center justify-center gap-1.5",
              activeTab === "create" ? "bg-white text-rose-600 shadow-md" : "text-slate-500 hover:text-rose-500"
            )}
          >
            <Play className="w-3.5 h-3.5 fill-current" /> Créer
          </button>
          <button 
            onClick={() => setActiveTab("join")}
            className={cn(
              "flex-1 py-3 text-xs uppercase tracking-widest font-extrabold rounded-xl transition-all flex items-center justify-center gap-1.5",
              activeTab === "join" ? "bg-white text-rose-600 shadow-md" : "text-slate-500 hover:text-rose-500"
            )}
          >
            <UserPlus className="w-3.5 h-3.5" /> Rejoindre
          </button>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-rose-50 border border-rose-200 text-rose-600 p-3.5 rounded-xl flex items-start gap-2.5 text-xs font-bold leading-tight"
          >
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)} className="font-bold opacity-60 hover:opacity-100">&times;</button>
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {activeTab === "create" ? (
            <motion.div 
              key="create-form"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-5"
            >
              <div className="bg-white rounded-2xl p-4 border border-rose-100 shadow-sm space-y-4">
                {/* Topic selection */}
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2.5 block">Thèmes du Quiz</label>
                  <input 
                    type="text"
                    value={config.topics}
                    onChange={e => setConfig({ ...config, topics: e.target.value })}
                    className="w-full text-sm p-3.5 bg-slate-50/70 border border-slate-100 rounded-xl focus:ring-2 focus:ring-rose-500 focus:bg-white outline-none font-bold transition-all"
                    placeholder="Ex: Amour, Voyage, Cuisine..."
                  />

                  {/* Preset Buttons Grid */}
                  <div className="grid grid-cols-3 gap-1.5 mt-3">
                    {PRESET_THEMES.map((theme, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setConfig({ ...config, topics: theme.value })}
                        className={cn(
                          "py-2 px-1 rounded-xl text-[10px] font-bold border flex flex-col items-center gap-1 transition-all",
                          config.topics === theme.value 
                            ? "bg-rose-500 text-white border-rose-500 shadow-sm" 
                            : "bg-white border-slate-100 text-slate-600 hover:bg-rose-50/50"
                        )}
                      >
                        <span className="text-sm">{theme.icon}</span>
                        <span>{theme.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Question count toggle bar instead of text box */}
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2 block">Nombre de questions</label>
                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    {[3, 5, 8, 10].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setConfig({ ...config, count: num })}
                        className={cn(
                          "flex-1 py-2 rounded-lg text-xs font-bold transition-all",
                          config.count === num
                            ? "bg-white text-slate-800 shadow-sm"
                            : "text-slate-500 hover:text-slate-700"
                        )}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Difficulty selector pills */}
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2 block">Atmosphère</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { val: "easy", label: "Câlin (Simple)", color: "text-green-600 bg-green-50 border-green-50" },
                      { val: "medium", label: "Passion (Séduisant)", color: "text-rose-600 bg-rose-50 border-rose-50" },
                      { val: "hard", label: "Fusion (Intime)", color: "text-purple-600 bg-purple-50 border-purple-50" }
                    ].map((diff) => (
                      <button
                        key={diff.val}
                        type="button"
                        onClick={() => setConfig({ ...config, difficulty: diff.val as any })}
                        className={cn(
                          "py-2.5 rounded-xl text-[10px] font-extrabold border-2 text-center transition-all",
                          config.difficulty === diff.val
                            ? "border-rose-500 bg-rose-500 text-white shadow-sm"
                            : `${diff.color} hover:opacity-80`
                        )}
                      >
                        {diff.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <motion.button 
                disabled={isCreating}
                onClick={handleCreate}
                whileTap={{ scale: 0.97 }}
                className="w-full bg-rose-500 shadow-lg shadow-rose-200 text-white font-extrabold py-4 rounded-2xl hover:bg-rose-600 transition-all flex items-center justify-center gap-2 relative z-10 text-sm disabled:opacity-50"
              >
                {isCreating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    MAGIE DE L'IA EN COURS...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 fill-current" />
                    GÉNÉRER LE QUIZ AMOUREUX
                  </>
                )}
              </motion.button>
            </motion.div>
          ) : (
            <motion.div 
              key="join-form"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="space-y-4"
            >
              <div className="bg-white rounded-2xl p-6 border border-rose-100 shadow-sm text-center space-y-5">
                <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center text-rose-500 mx-auto">
                  <UserPlus className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-lg">Rejoindre la Synchronisation</h3>
                  <p className="text-slate-400 text-xs mt-1.5 max-w-[240px] mx-auto">
                    Entrez le code secret à 4 chiffres généré par votre partenaire pour synchroniser vos réponses.
                  </p>
                </div>

                <div className="max-w-[200px] mx-auto">
                  <input 
                    placeholder="0000"
                    maxLength={4}
                    value={joinId}
                    onChange={e => setJoinId(e.target.value.replace(/\D/g, ''))}
                    className="w-full p-3.5 text-center text-3xl font-mono font-black bg-slate-50 border-2 border-slate-100 focus:border-rose-300 rounded-xl tracking-[0.3em] outline-none transition-colors text-slate-700"
                  />
                </div>
              </div>

              <motion.button 
                onClick={handleJoin}
                whileTap={{ scale: 0.97 }}
                className="w-full bg-slate-900 text-white font-extrabold py-4 rounded-xl hover:bg-slate-800 transition-all shadow-md text-sm uppercase tracking-wide"
              >
                CONFIRMER ET JOUER !
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="pt-6 text-center text-[10px] text-slate-400">
        <Compass className="w-4 h-4 mx-auto mb-1 text-slate-300" />
        <p>Déjà plus de 10 000 duos synchronisés à l'unisson ✨</p>
      </div>
    </div>
  );
}

function GameRoom({ sessionId, onLeave }: { sessionId: string, onLeave: () => void }) {
  const { user } = useAuth();
  const [session, setSession] = useState<any>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [userAnswer, setUserAnswer] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"quiz" | "chat" | "info">("quiz");
  
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat to bottom
  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (activeTab === "chat") {
      scrollToBottom();
    }
  }, [messages, activeTab]);

  useEffect(() => {
    setUserAnswer(null);
  }, [session?.currentQuestionIndex]);

  useEffect(() => {
    if (!sessionId) return;
    const unsubSession = onSnapshot(doc(db, "sessions", sessionId), (doc) => setSession(doc.data()));
    const unsubQuestions = onSnapshot(query(collection(db, `sessions/${sessionId}/questions`), orderBy("order", "asc")), (snap) => setQuestions(snap.docs.map(d => d.data() as QuizQuestion)));
    const unsubAnswers = onSnapshot(collection(db, `sessions/${sessionId}/answers`), (snap) => setAnswers(snap.docs.map(d => d.data())));
    const q = query(collection(db, `sessions/${sessionId}/messages`), orderBy("timestamp", "asc"), limit(30));
    const unsubMessages = onSnapshot(q, (snap) => setMessages(snap.docs.map(d => d.data())));
    return () => { unsubSession(); unsubQuestions(); unsubAnswers(); unsubMessages(); };
  }, [sessionId]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !user) return;
    try {
      await addDoc(collection(db, `sessions/${sessionId}/messages`), {
        senderId: user.uid,
        text: newMessage,
        timestamp: serverTimestamp()
      });
      setNewMessage("");
    } catch (e) {
      console.error(e);
    }
  };

  const handleAnswer = async (index: number) => {
    if (!user || userAnswer !== null) return;
    setUserAnswer(index);
    try {
      await addDoc(collection(db, `sessions/${sessionId}/answers`), {
        userId: user.uid,
        questionIndex: session?.currentQuestionIndex || 0,
        answerIndex: index,
        timestamp: serverTimestamp()
      });
    } catch (e) {
      console.error(e);
    }
  };

  const nextQuestion = async () => {
    if (session.currentQuestionIndex < questions.length - 1) {
      await updateDoc(doc(db, "sessions", sessionId), {
        currentQuestionIndex: session.currentQuestionIndex + 1,
        updatedAt: serverTimestamp()
      });
      setUserAnswer(null);
    } else {
      await updateDoc(doc(db, "sessions", sessionId), {
        status: "completed",
        updatedAt: serverTimestamp()
      });
    }
  };

  const copyCode = () => {
    if (!session) return;
    navigator.clipboard.writeText(session.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getShareLink = () => {
    if (!session) return "";
    return `${window.location.origin}/?join=${session.id}`;
  };

  const getShareMessage = () => {
    if (!session) return "";
    const themesStr = session.config?.topics?.join(", ") || "";
    return `Rejoins mon quiz amoureux "Cœur à Cœur" ! Mon code de session est : ${session.id}${themesStr ? ` (Thèmes : ${themesStr})` : ""}\nClique ici pour rejoindre en direct : ${getShareLink()}`;
  };

  const copyLink = () => {
    const link = getShareLink();
    if (!link) return;
    navigator.clipboard.writeText(link);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const shareOnWhatsApp = () => {
    const text = encodeURIComponent(getShareMessage());
    window.open(`https://api.whatsapp.com/send?text=${text}`, "_blank");
  };

  const shareViaSMS = () => {
    const text = encodeURIComponent(getShareMessage());
    window.open(`sms:?body=${text}`, "_self");
  };

  const shareNative = async () => {
    const link = getShareLink();
    if (!link) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Cœur à Cœur",
          text: `Rejoins mon quiz amoureux "Cœur à Cœur" !`,
          url: link,
        });
      } catch (err) {
        console.log("Error sharing", err);
      }
    } else {
      copyLink();
    }
  };

  const handleAbandon = async () => {
    if (!user || !session) {
      onLeave();
      return;
    }
    try {
      if (session.joinerId) {
        await updateDoc(doc(db, "sessions", sessionId), {
          status: "abandoned",
          abandonedBy: user.uid,
          abandonedByName: user.displayName || "Votre partenaire",
          updatedAt: serverTimestamp()
        });
      } else {
        await updateDoc(doc(db, "sessions", sessionId), {
          status: "cancelled",
          updatedAt: serverTimestamp()
        });
      }
    } catch (e) {
      console.error("Error leaving session:", e);
    }
    onLeave();
  };

  if (!session || questions.length === 0) return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white/40">
      <div className="w-14 h-14 bg-rose-50 rounded-full flex items-center justify-center text-rose-500 animate-spin mb-4 shadow-sm border border-rose-100">
        <Heart className="w-7 h-7 fill-current" />
      </div>
      <p className="font-extrabold text-[#f43f5e] text-sm uppercase tracking-widest animate-pulse">
        Établissement du lien spirituel...
      </p>
    </div>
  );

  const currentQ = questions[session.currentQuestionIndex];
  const participantAnswers = answers.filter(a => a.questionIndex === session.currentQuestionIndex);
  const uniqueAnswerers = new Set(participantAnswers.map(a => a.userId)).size;
  const bothAnswered = uniqueAnswerers >= (session.joinerId ? 2 : 1);

  // Status check variables for real-time progress indicators
  const myAnswerId = participantAnswers.find(a => a.userId === user?.uid)?.answerIndex;
  const partnerId = session.creatorId === user?.uid ? session.joinerId : session.creatorId;
  const partnerReplied = partnerId ? participantAnswers.some(a => a.userId === partnerId) : false;

  if (session.status === "completed") {
    return <Results questions={questions} answers={answers} onLeave={onLeave} session={session} />;
  }

  if (session.status === "abandoned") {
    const abandonedByName = session.abandonedByName || "Votre partenaire";
    const isMeWhoAbandoned = session.abandonedBy === user?.uid;
    
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex-1 flex flex-col justify-center items-center p-6 text-center bg-[#FFF5F7]/30"
      >
        <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500 mb-5 shadow-sm border border-rose-100">
          <AlertCircle className="w-8 h-8 text-rose-500 animate-pulse" />
        </div>
        
        <h2 className="text-lg font-extrabold text-slate-800 tracking-tight mb-2">Quiz Interrompu 💔</h2>
        
        <p className="text-slate-500 text-xs max-w-[280px] mx-auto leading-relaxed mb-6">
          {isMeWhoAbandoned ? (
            "Vous avez quitté et abandonné la session."
          ) : (
            <span><strong>{abandonedByName}</strong> a quitté la session de jeu. Le quiz a été interrompu.</span>
          )}
        </p>

        <motion.button 
          whileTap={{ scale: 0.95 }}
          onClick={onLeave}
          className="w-full max-w-[200px] bg-rose-500 text-white font-extrabold py-3 rounded-xl hover:bg-rose-600 shadow-md transition-all text-xs uppercase tracking-wider"
        >
          Retourner à l'accueil
        </motion.button>
      </motion.div>
    );
  }

  // Waiting View for Creator
  if (!session.joinerId && session.creatorId === user?.uid) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex-1 flex flex-col justify-between p-6 text-center"
      >
        <div className="space-y-6 flex-1 flex flex-col justify-center">
          <div className="w-20 h-20 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500 mx-auto animate-pulse">
            <UserPlus className="w-9 h-9" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">Le quiz est prêt !</h2>
            <p className="text-slate-400 text-xs mt-2 max-w-[280px] mx-auto leading-relaxed">
              Le quiz IA a été généré avec succès. Partagez ce code avec votre partenaire pour commencer à jouer.
            </p>
          </div>

          <div className="relative max-w-[200px] mx-auto py-2 group">
            <div 
              onClick={copyCode}
              title="Copier le code"
              className="bg-rose-500 hover:bg-rose-600 active:scale-95 text-white py-4 px-6 rounded-2xl text-4xl font-mono font-black tracking-widest shadow-lg shadow-rose-200 cursor-pointer relative transition-all"
            >
              {session.id}
              <div className="absolute top-1 right-1 p-1 bg-white/20 rounded-lg text-white">
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </div>
            </div>
            {copied && (
              <span className="text-[10px] bg-emerald-500 text-white rounded-full px-2 py-0.5 absolute -bottom-2 left-1/2 -translate-x-1/2 font-bold shadow-sm">
                Code copié !
              </span>
            )}
          </div>

          <div className="pt-4 max-w-[320px] mx-auto space-y-4">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Partager l'invitation</span>
            
            <div className="grid grid-cols-3 gap-2.5">
              {/* WhatsApp Share Button */}
              <button 
                onClick={shareOnWhatsApp}
                className="flex flex-col items-center justify-center p-3 rounded-2xl border border-emerald-100 bg-emerald-50/50 hover:bg-emerald-50 text-emerald-600 transition-all group/btn active:scale-95"
              >
                <div className="w-9 h-9 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-md shadow-emerald-100 mb-1.5 transition-transform group-hover/btn:scale-110">
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                    <path d="M12.031 6.062c-3.273 0-5.938 2.665-5.938 5.938 0 1.277.401 2.467 1.085 3.447l-.711 2.597 2.663-.698c.942.513 2.019.808 3.16.808 3.273 0 5.938-2.665 5.938-5.938s-2.665-5.94-5.938-5.94zm3.435 8.163c-.15.422-.767.767-1.077.808-.266.035-.615.053-.948.053-.518 0-1.189-.136-1.921-.444-1.229-.516-2.029-1.765-2.091-1.848-.06-.083-.501-.664-.501-1.267 0-.603.315-.898.427-1.013.113-.115.247-.143.33-.143.082 0 .165 0 .237.005.077.001.182-.03.284.22.103.25.352.859.382.923.03.064.053.138.01.223-.043.085-.064.138-.128.213-.064.075-.135.168-.192.226-.064.064-.131.133-.056.262.075.127.33.541.706.877.485.433.894.568 1.019.631.125.064.2.053.245-.002.045-.053.193-.223.245-.298.051-.075.103-.064.175-.037.072.027.455.215.533.253.078.038.13.058.15.09.02.033.02.189-.055.408z" />
                    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 1.83.491 3.545 1.345 5.02L1 23l6.108-1.579A9.956 9.956 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18c-1.63 0-3.155-.494-4.425-1.338l-.317-.189-3.612.934.957-3.483-.211-.328A7.954 7.954 0 014 12c0-4.411 3.589-8 8-8s8 3.589 8 8-3.589 8-8 8z" />
                  </svg>
                </div>
                <span className="text-[10px] font-black tracking-wide leading-tight mt-0.5">WhatsApp</span>
              </button>

              {/* SMS Share Button */}
              <button 
                onClick={shareViaSMS}
                className="flex flex-col items-center justify-center p-3 rounded-2xl border border-sky-100 bg-sky-50/50 hover:bg-sky-50 text-sky-600 transition-all group/btn active:scale-95"
              >
                <div className="w-9 h-9 bg-sky-500 text-white rounded-full flex items-center justify-center shadow-md shadow-sky-100 mb-1.5 transition-transform group-hover/btn:scale-110">
                  <MessageSquare className="w-4.5 h-4.5" />
                </div>
                <span className="text-[10px] font-black tracking-wide leading-tight mt-0.5">SMS</span>
              </button>

              {/* Copy Link Button */}
              <button 
                onClick={copyLink}
                className="flex flex-col items-center justify-center p-3 rounded-2xl border border-rose-100 bg-rose-50/40 hover:bg-rose-50 text-rose-600 transition-all group/btn active:scale-95 relative"
              >
                <div className="w-9 h-9 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-md shadow-rose-100 mb-1.5 transition-transform group-hover/btn:scale-110">
                  {linkCopied ? <Check className="w-4.5 h-4.5" /> : <Copy className="w-4.5 h-4.5" />}
                </div>
                <span className="text-[10px] font-black tracking-wide leading-tight mt-0.5">
                  {linkCopied ? "Copié !" : "Copier lien"}
                </span>
              </button>
            </div>
            
            {navigator.share && (
              <button 
                onClick={shareNative}
                className="w-full inline-flex items-center justify-center gap-1.5 text-[10px] font-black text-rose-500 uppercase tracking-wider py-2.5 px-3 rounded-xl border border-rose-100 bg-white hover:bg-rose-50 active:bg-rose-100 transition-colors"
              >
                <Share2 className="w-3.5 h-3.5" /> Plus d'options...
              </button>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 text-rose-400 text-xs">
            <div className="w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping" />
            <span className="font-extrabold uppercase tracking-widest italic text-[10px]">
              Attente de connexion...
            </span>
          </div>

          <button 
            onClick={handleAbandon}
            className="w-full text-slate-400 hover:text-slate-500 font-bold text-xs uppercase tracking-wider block py-2"
          >
            Retourner au menu
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="flex-1 flex flex-col justify-between overflow-hidden">
      
      {/* Dynamic Tab Panel Container */}
      <div className="flex-1 overflow-hidden flex flex-col relative">
        <AnimatePresence mode="wait">
          {activeTab === "quiz" && (
            <motion.div 
              key="quiz"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="flex-1 overflow-y-auto px-4 py-5 flex flex-col justify-between custom-scrollbar"
            >
              <div>
                {/* Question Progress Bar */}
                <div className="space-y-1.5 mb-5">
                  <div className="flex items-center justify-between text-[11px] font-extrabold">
                    <span className="bg-rose-100 text-[#f43f5e] uppercase px-2.5 py-1 rounded-full text-[9px] tracking-widest font-black shrink-0 md:bg-[#FFF5F7]">
                      {currentQ.category}
                    </span>
                    <span className="text-slate-500 italic">
                      Question {session.currentQuestionIndex + 1} de {questions.length}
                    </span>
                  </div>
                  <div className="w-full bg-slate-200/50 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-rose-500 h-full transition-all duration-300" 
                      style={{ width: `${((session.currentQuestionIndex + 1) / questions.length) * 100}%` }}
                    />
                  </div>
                </div>

                <h2 className="text-base sm:text-lg font-black text-slate-800 leading-snug tracking-tight mb-6">
                  {currentQ.text}
                </h2>

                {/* Option Buttons */}
                <div className="space-y-3">
                  {currentQ.options.map((opt, i) => {
                    const isSelected = userAnswer === i;
                    return (
                      <motion.button 
                        key={i}
                        disabled={userAnswer !== null}
                        onClick={() => handleAnswer(i)}
                        whileTap={{ scale: 0.98 }}
                        className={cn(
                          "w-full flex items-center gap-3.5 border-2 rounded-2xl p-3.5 text-left transition-all relative overflow-hidden group/opt text-xs md:text-sm shadow-sm",
                          isSelected 
                            ? "bg-gradient-to-r from-rose-500 to-pink-500 border-rose-500 text-white shadow-md shadow-rose-200" 
                            : "bg-white border-slate-50 hover:border-rose-100 hover:bg-rose-50/20 text-slate-700"
                        )}
                      >
                        <div className={cn(
                          "w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs transition-colors shrink-0",
                          isSelected 
                            ? "bg-white/20 text-white" 
                            : "bg-rose-50 text-rose-500 group-hover/opt:bg-rose-100"
                        )}>
                          {String.fromCharCode(65 + i)}
                        </div>
                        <p className="font-bold leading-normal flex-1">{opt}</p>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Status Section & Submit Control */}
              <div className="pt-5 border-t border-rose-100/60 mt-6 shrink-0">
                {bothAnswered ? (
                  <motion.button 
                    whileTap={{ scale: 0.95 }}
                    onClick={nextQuestion}
                    className="w-full bg-slate-900 text-white font-extrabold py-3.5 rounded-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-1.5 shadow-md text-xs uppercase tracking-wider"
                  >
                    {session.currentQuestionIndex < questions.length - 1 ? (
                      <>
                        Question Suivante
                        <ChevronRight className="w-4 h-4" />
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 fill-current animate-pulse text-amber-300" />
                        Voir les Résultats !
                      </>
                    )}
                  </motion.button>
                ) : (
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <div className="flex items-center gap-1.5">
                      <div className={cn(
                        "w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black",
                        myAnswerId !== undefined ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-400"
                      )}>
                        {myAnswerId !== undefined ? "✓" : "?"}
                      </div>
                      <span className="text-slate-500">Moi ({myAnswerId !== undefined ? "Répondu" : "Pense"})</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500">
                        {partnerReplied ? "Partenaire (Prêt !)" : "Partenaire (Réfléchit...)"}
                      </span>
                      <div className={cn(
                        "w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black",
                        partnerReplied ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-400"
                      )}>
                        {partnerReplied ? "✓" : "?"}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === "chat" && (
            <motion.div 
              key="chat"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="flex-1 flex flex-col justify-between overflow-hidden"
            >
              {/* Messages Body */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 custom-scrollbar">
                {messages.map((m, i) => {
                  const isOwn = m.senderId === user?.uid;
                  return (
                    <div key={i} className={cn("flex flex-col", isOwn ? "items-end" : "items-start")}>
                      <div className={cn(
                        "px-4 py-2.5 text-xs font-bold shadow-sm max-w-[80%]",
                        isOwn 
                          ? "bg-rose-500 text-white rounded-3xl rounded-tr-none" 
                          : "bg-white text-slate-700 border border-slate-100 rounded-3xl rounded-tl-none"
                      )}>
                        {m.text}
                      </div>
                    </div>
                  );
                })}
                {messages.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-center opacity-30 italic py-10">
                    <Heart className="w-12 h-12 text-rose-300 fill-rose-100 mb-3" />
                    <p className="text-slate-500 text-xs font-bold">Un débrief sur la question ?<br/>Discutez ici de vos réponses !</p>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input Bar */}
              <div className="p-3 bg-white border-t border-rose-50 shrink-0 flex items-center gap-2">
                <input 
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSendMessage()}
                  placeholder="Écrire un message..." 
                  className="bg-slate-100 text-xs font-bold outline-none flex-grow px-4 py-3 rounded-xl border border-transparent focus:bg-white focus:border-rose-200 transition-all text-slate-700"
                />
                <button 
                  onClick={handleSendMessage}
                  className="w-10 h-10 bg-rose-500 text-white rounded-xl flex items-center justify-center shadow-md active:scale-90 transition-transform shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {activeTab === "info" && (
            <motion.div 
              key="info"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="flex-1 overflow-y-auto px-4 py-5 space-y-4 custom-scrollbar"
            >
              <div className="bg-white rounded-2xl p-5 border border-rose-50 shadow-sm text-center">
                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block mb-1">Code de Synchro</span>
                <div 
                  onClick={copyCode}
                  className="text-4xl font-mono font-black text-rose-500 tracking-wider inline-block cursor-pointer select-all border-b border-rose-100 pb-1"
                >
                  {session.id}
                </div>
                {copied && (
                  <p className="text-[10px] text-emerald-500 font-bold mt-1.5 animate-pulse">Code copié avec succès !</p>
                )}
                <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                  Cliquez sur le code pour le copier et l'envoyer à votre partenaire.
                </p>
              </div>

              {/* Instant Share Grid */}
              <div className="bg-white rounded-2xl p-5 border border-rose-50 shadow-sm space-y-3.5">
                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block text-center">Partager direct d'invitation</span>
                
                <div className="grid grid-cols-3 gap-2">
                  {/* WhatsApp */}
                  <button 
                    onClick={shareOnWhatsApp}
                    className="flex flex-col items-center justify-center p-2.5 rounded-xl border border-emerald-50 bg-emerald-50/20 hover:bg-emerald-50 text-emerald-600 transition-all active:scale-95 text-[10px] font-bold"
                  >
                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current text-emerald-500 mb-1">
                      <path d="M12.031 6.062c-3.273 0-5.938 2.665-5.938 5.938 0 1.277.401 2.467 1.085 3.447l-.711 2.597 2.663-.698c.942.513 2.019.808 3.16.808 3.273 0 5.938-2.665 5.938-5.938s-2.665-5.94-5.938-5.94zm3.435 8.163c-.15.422-.767.767-1.077.808-.266.035-.615.053-.948.053-.518 0-1.189-.136-1.921-.444-1.229-.516-2.029-1.765-2.091-1.848-.06-.083-.501-.664-.501-1.267 0-.603.315-.898.427-1.013.113-.115.247-.143.33-.143.082 0 .165 0 .237.005.077.001.182-.03.284.22.103.25.352.859.382.923.03.064.053.138.01.223-.043.085-.064.138-.128.213-.064.075-.135.168-.192.226-.064.064-.131.133-.056.262.075.127.33.541.706.877.485.433.894.568 1.019.631.125.064.2.053.245-.002.045-.053.193-.223.245-.298.051-.075.103-.064.175-.037.072.027.455.215.533.253.078.038.13.058.15.09.02.033.02.189-.055.408z" />
                      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 1.83.491 3.545 1.345 5.02L1 23l6.108-1.579A9.956 9.956 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18c-1.63 0-3.155-.494-4.425-1.338l-.317-.189-3.612.934.957-3.483-.211-.328A7.954 7.954 0 014 12c0-4.411 3.589-8 8-8s8 3.589 8 8-3.589 8-8 8z" />
                    </svg>
                    WhatsApp
                  </button>

                  {/* SMS */}
                  <button 
                    onClick={shareViaSMS}
                    className="flex flex-col items-center justify-center p-2.5 rounded-xl border border-sky-50 bg-sky-50/20 hover:bg-sky-50 text-sky-600 transition-all active:scale-95 text-[10px] font-bold"
                  >
                    <MessageSquare className="w-5 h-5 text-sky-500 mb-1" />
                    SMS
                  </button>

                  {/* Copy Link */}
                  <button 
                    onClick={copyLink}
                    className="flex flex-col items-center justify-center p-2.5 rounded-xl border border-rose-50 bg-rose-50/20 hover:bg-rose-50 text-rose-600 transition-all active:scale-95 text-[10px] font-bold"
                  >
                    {linkCopied ? (
                      <Check className="w-5 h-5 text-emerald-500 mb-1" />
                    ) : (
                      <Copy className="w-5 h-5 text-rose-500 mb-1" />
                    )}
                    {linkCopied ? "Copié !" : "Lien"}
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-rose-100 shadow-sm space-y-4">
                <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider border-b border-slate-50 pb-2 flex items-center justify-between">
                  <span>Détails de la Session</span>
                  <span className="bg-green-100 text-green-600 px-2 py-0.5 rounded-full text-[8px]">En cours</span>
                </h3>
                <div className="space-y-3.5 text-xs font-medium text-slate-600">
                  <div className="flex justify-between items-center">
                    <span>Difficulté :</span>
                    <span className="font-bold text-slate-800 bg-rose-50 px-2 py-1 rounded-lg">
                      {session.config.difficulty === "easy" ? "Câlin" : session.config.difficulty === "medium" ? "Passion" : "Fusion"}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <span>Thèmes abordés :</span>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {session.config.topics.map((t: string, i: number) => (
                        <span key={i} className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full text-[9px] font-bold">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <button 
                onClick={handleAbandon}
                className="w-full py-3.5 bg-rose-50 text-rose-600 rounded-xl font-extrabold text-xs uppercase tracking-wider border border-rose-100 hover:bg-rose-100 transition-colors block text-center"
              >
                Quitter et abandonner le quiz
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Permanent Bottom Nav Bar */}
      <div className="bg-white border-t border-rose-100 px-3 py-2 flex items-center justify-around shrink-0 pb-safe shadow-md z-20">
        {[
          { id: "quiz", label: "Quiz", icon: Play },
          { id: "chat", label: "Chat", icon: MessageCircle, badge: messages.length > 0 },
          { id: "info", label: "Infos", icon: Settings },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex flex-col items-center gap-1 py-1 py-1.5 px-5 rounded-2xl transition-all relative shrink-0",
                isActive ? "text-rose-500 font-bold bg-rose-50/50" : "text-slate-400 hover:text-rose-400"
              )}
            >
              <div className="relative">
                <Icon className={cn("w-5.5 h-5.5", isActive ? "stroke-[2.5]" : "stroke-2")} />
                {tab.badge && !isActive && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-rose-500 rounded-full border-2 border-white animate-pulse" />
                )}
              </div>
              <span className="text-[9px] tracking-wider uppercase font-extrabold">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Results({ questions, answers, onLeave, session }: { questions: QuizQuestion[], answers: any[], onLeave: () => void, session: any }) {
  const { profile } = useAuth();
  const [result, setResult] = useState<{ score: number, analysis: string } | null>(null);

  useEffect(() => {
    const calc = async () => {
      const users = Array.from(new Set(answers.map(a => a.userId)));
      if (users.length < 2) {
        setResult({ score: 0, analysis: "Oops ! On dirait que votre partenaire a pris la fuite avant la fin. La compatibilité est un sport d'équipe ! 💔" });
        return;
      }
      
      const u1Answers = answers.filter(a => a.userId === session.creatorId).sort((a, b) => a.questionIndex - b.questionIndex).map(a => a.answerIndex);
      const u2Answers = answers.filter(a => a.userId === session.joinerId).sort((a, b) => a.questionIndex - b.questionIndex).map(a => a.answerIndex);
      const res = await evaluateCompatibility(u1Answers, u2Answers, questions, profile?.geminiApiKey);
      setResult(res);
    };
    calc();
  }, [answers, questions]);

  if (!result) return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white/40">
      <div className="w-14 h-14 bg-rose-50 rounded-full flex items-center justify-center text-rose-500 animate-bounce mb-4 shadow-sm border border-rose-100">
        <Heart className="w-7 h-7 fill-current" />
      </div>
      <p className="font-extrabold text-[#f43f5e] text-sm uppercase tracking-widest animate-pulse">
        Analyse du cosmos amoureux...
      </p>
    </div>
  );

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex-1 overflow-y-auto px-4 py-5 flex flex-col justify-between custom-scrollbar space-y-6"
    >
      <div className="bg-white rounded-3xl p-5 border border-rose-100 shadow-sm text-center relative overflow-hidden">
        {/* Progress SVG Dial */}
        <div className="relative w-36 h-36 flex items-center justify-center mx-auto mb-4">
          <svg className="w-full h-full transform -rotate-90">
            <circle cx="72" cy="72" r="64" stroke="#FFF1F2" strokeWidth="10" fill="transparent" />
            <motion.circle 
              cx="72" cy="72" r="64" stroke="#f43f5e" strokeWidth="10" fill="transparent"
              strokeDasharray={402}
              initial={{ strokeDashoffset: 402 }}
              animate={{ strokeDashoffset: 402 - (402 * result.score) / 100 }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute flex flex-col items-center justify-center">
            <span className="text-4xl font-black text-slate-800 font-mono tracking-tight">{result.score}%</span>
            <span className="text-[9px] font-bold text-rose-500 tracking-widest uppercase">Love Sync</span>
          </div>
        </div>

        <h2 className="text-xl font-extrabold text-slate-850 mb-2">Verdict Amoureux</h2>
        <p className="text-xs text-slate-500 leading-normal italic px-2">
          “{result.analysis}”
        </p>
      </div>

      {/* Review of all answers */}
      <div className="space-y-3.5">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 px-2">
          <Sparkles className="w-3.5 h-3.5 text-rose-500" /> Analyse Question par Question
        </h3>
        
        <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-1.5">
          {questions.map((q, idx) => {
            const creatorAns = answers.find(a => a.userId === session.creatorId && a.questionIndex === idx)?.answerIndex;
            const joinerAns = answers.find(a => a.userId === session.joinerId && a.questionIndex === idx)?.answerIndex;
            const isMatch = creatorAns === joinerAns && creatorAns !== undefined;

            return (
              <div key={idx} className={cn(
                "p-3.5 rounded-2xl border text-left transition-all",
                isMatch ? "bg-rose-50/50 border-rose-100" : "bg-white border-slate-100"
              )}>
                <div className="flex items-center justify-between mb-2 gap-2 text-[10px] font-bold uppercase">
                  <span className="text-slate-400">Q{idx + 1} • {q.category}</span>
                  {isMatch ? (
                    <span className="bg-rose-500 text-white px-2 py-0.5 rounded-lg text-[8px] tracking-wide font-black">
                      💚 OSMOSE
                    </span>
                  ) : (
                    <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-lg text-[8px] tracking-wide font-black">
                      🧩 UNIQUE
                    </span>
                  )}
                </div>
                <p className="font-extrabold text-xs text-slate-800 mb-3 line-clamp-2">{q.text}</p>
                
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div className="bg-white/80 border border-slate-50 p-2 rounded-xl">
                    <p className="text-rose-400 font-extrabold mb-0.5">Votre choix</p>
                    <p className="font-bold text-slate-700 leading-tight">
                      {creatorAns !== undefined ? q.options[creatorAns] : "Pas de réponse"}
                    </p>
                  </div>
                  <div className="bg-white/80 border border-slate-50 p-2 rounded-xl">
                    <p className="text-rose-400 font-extrabold mb-0.5">Partenaire</p>
                    <p className="font-bold text-slate-700 leading-tight">
                      {joinerAns !== undefined ? q.options[joinerAns] : "Pas de réponse"}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <motion.button 
        whileTap={{ scale: 0.95 }}
        onClick={onLeave}
        className="w-full bg-rose-500 text-white font-extrabold py-3.5 rounded-2xl hover:bg-rose-600 shadow-md transition-all text-xs uppercase"
      >
        RETOUR AU BUREAU D'ACCUEIL
      </motion.button>
    </motion.div>
  );
}
