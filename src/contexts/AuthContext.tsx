import React, { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "../firebase";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import type { UserCredential } from 'firebase/auth';
import type { FirebaseUserWithData } from '../types/usuario';

interface AuthContextValue {
  user: FirebaseUserWithData | null;
  login: (email: string, password: string) => Promise<UserCredential>;
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

/**
 * Verifica si activoHasta está vencido.
 * Soporta string YYYY-MM-DD y Firestore Timestamp.
 */
function isExpired(activoHasta: unknown): boolean {
  if (!activoHasta) return false;

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  let fechaLimite: Date;

  if (typeof activoHasta === "string") {
    fechaLimite = new Date(activoHasta);
  } else if (typeof (activoHasta as { toDate?: () => Date }).toDate === 'function') {
    fechaLimite = (activoHasta as { toDate: () => Date }).toDate();
  } else if (activoHasta instanceof Date) {
    fechaLimite = activoHasta;
  } else {
    return false;
  }

  fechaLimite.setHours(0, 0, 0, 0);
  return fechaLimite < hoy;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUserWithData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const ref = doc(db, "usuarios", firebaseUser.uid);
        const snap = await getDoc(ref);
        const userData = snap.exists() ? (snap.data() as Record<string, unknown>) : {};

        // 🔒 Cuenta vencida → cerrar sesión automáticamente
        if (isExpired(userData.activoHasta)) {
          await signOut(auth);
          return;
        }

        setUser({ ...firebaseUser, ...userData } as FirebaseUserWithData);
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      setLoading(true);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      if (!userCredential || !userCredential.user) {
        throw new Error("Error al iniciar sesión. Intente nuevamente.");
      }

      const firebaseUser = userCredential.user;

      const ref = doc(db, "usuarios", firebaseUser.uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await signOut(auth);
        setLoading(false);
        throw new Error("Usuario no registrado en la base de datos");
      }
      const userData = snap.data() as Record<string, unknown>;

      if (userData.estado === "inactivo") {
        await signOut(auth);
        setLoading(false);
        throw new Error("Tu cuenta está inactiva. Contacta al administrador.");
      }

      if (isExpired(userData.activoHasta)) {
        await signOut(auth);
        setLoading(false);
        throw new Error("Tu cuenta ha vencido. Contacta al administrador para renovar.");
      }

      setUser({ ...firebaseUser, ...userData } as FirebaseUserWithData);
      setLoading(false);
      return userCredential;
    } catch (error) {
      console.error("Error en login:", error);
      setLoading(false);
      throw error;
    }
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
