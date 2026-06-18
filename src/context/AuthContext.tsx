import React, { createContext, useContext, useEffect, useState } from "react";
import { User, onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";

export interface AuthProfile {
  displayName?: string;
  photoURL?: string;
  geminiApiKey?: string;
}

interface AuthContextType {
  user: User | null;
  profile: AuthProfile | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = undefined;
      }

      if (currentUser) {
        const userRef = doc(db, "users", currentUser.uid);
        unsubscribeProfile = onSnapshot(userRef, (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            setProfile({
              displayName: data.displayName || currentUser.displayName || "Utilisateur",
              photoURL: data.photoURL || currentUser.photoURL || "",
              geminiApiKey: data.geminiApiKey || "",
            });
          } else {
            setProfile({
              displayName: currentUser.displayName || "Utilisateur",
              photoURL: currentUser.photoURL || "",
              geminiApiKey: "",
            });
          }
          setLoading(false);
        }, (error) => {
          console.error("Error listening to user profile:", error);
          // Fallback if snapshot fails
          setProfile({
            displayName: currentUser.displayName || "Utilisateur",
            photoURL: currentUser.photoURL || "",
            geminiApiKey: "",
          });
          setLoading(false);
        });
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  return (
    <div key={user?.uid}>
      <AuthContext.Provider value={{ user, profile, loading }}>
        {!loading && children}
      </AuthContext.Provider>
    </div>
  );
}
////////////////////////////////////////////////////
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
