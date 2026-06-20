import React, { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "../firebase";
import {
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updateEmail,
  updatePassword,
} from "firebase/auth";
import { collection, addDoc, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import type { UserCredential } from 'firebase/auth';
import type { FirebaseUserWithData } from '../types/usuario';

interface AuthContextValue {
  user: FirebaseUserWithData | null;
  login: (email: string, password: string) => Promise<UserCredential>;
  register: (data: { nombre: string; correo: string; password: string; moneda: string; tasa: number }) => Promise<UserCredential>;
  logout: () => Promise<void>;
  loading: boolean;
  updateProfileData: (data: { nombre?: string }) => Promise<void>;
  updateUserEmail: (newEmail: string, currentPassword: string) => Promise<void>;
  updateUserPassword: (newPassword: string, currentPassword: string) => Promise<void>;
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

  const register = async (data: { nombre: string; correo: string; password: string; moneda: string; tasa: number }) => {
    try {
      setLoading(true);
      const userCredential = await createUserWithEmailAndPassword(auth, data.correo, data.password);
      const uid = userCredential.user.uid;

      const profile = {
        nombre: data.nombre,
        correo: data.correo,
        rol: 'usuario',
        estado: 'activo',
        moneda: data.moneda,
        tasa: data.tasa,
        activoHasta: '',
        createdAt: new Date().toISOString(),
      };

      await setDoc(doc(db, 'usuarios', uid), profile);
      setUser({ ...userCredential.user, ...profile } as FirebaseUserWithData);
      setLoading(false);
      return userCredential;
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const reauthenticate = async (password: string): Promise<void> => {
    if (!auth.currentUser?.email) throw new Error("No hay sesión activa");
    const credential = EmailAuthProvider.credential(auth.currentUser.email, password);
    await reauthenticateWithCredential(auth.currentUser, credential);
  };

  const updateProfileData = async (data: { nombre?: string }): Promise<void> => {
    if (!user?.uid) throw new Error("No hay sesión activa");
    await updateDoc(doc(db, "usuarios", user.uid), data);
    setUser(prev => prev ? { ...prev, ...data } as FirebaseUserWithData : null);
  };

  const updateUserEmail = async (newEmail: string, currentPassword: string): Promise<void> => {
    if (!auth.currentUser) throw new Error("No hay sesión activa");
    await reauthenticate(currentPassword);
    await updateEmail(auth.currentUser, newEmail);
    await updateDoc(doc(db, "usuarios", auth.currentUser.uid), { correo: newEmail });
    setUser(prev => prev ? { ...prev, correo: newEmail } as FirebaseUserWithData : null);
    try {
      await addDoc(collection(db, 'notificacionesEmail'), {
        tipo: 'email_changed',
        nuevoCorreo: newEmail,
        nombre: user?.nombre || 'Usuario',
        uid: auth.currentUser.uid,
        fecha: new Date().toISOString(),
      });
    } catch (e) {
      console.error('Error encolando notificación email:', e);
    }
  };

  const updateUserPassword = async (newPassword: string, currentPassword: string): Promise<void> => {
    if (!auth.currentUser) throw new Error("No hay sesión activa");
    await reauthenticate(currentPassword);
    await updatePassword(auth.currentUser, newPassword);
    try {
      await addDoc(collection(db, 'notificacionesEmail'), {
        tipo: 'password_changed',
        nombre: user?.nombre || 'Usuario',
        uid: auth.currentUser.uid,
        fecha: new Date().toISOString(),
      });
    } catch (e) {
      console.error('Error encolando notificación email:', e);
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading, updateProfileData, updateUserEmail, updateUserPassword }}>
      {children}
    </AuthContext.Provider>
  );
}
