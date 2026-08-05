import React, { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "../firebase";
import {
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateEmail,
  updatePassword,
} from "firebase/auth";
import { collection, addDoc, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { getFunctions, httpsCallable } from 'firebase/functions';
import type { UserCredential } from 'firebase/auth';
import type { FirebaseUserWithData } from '../types/usuario';

interface AuthContextValue {
  user: FirebaseUserWithData | null;
  login: (email: string, password: string) => Promise<UserCredential>;
  loginWithGoogle: () => Promise<void>;
  register: (data: { nombre: string; correo: string; password: string; moneda: string; tasa: number }) => Promise<UserCredential>;
  logout: () => Promise<void>;
  loading: boolean;
  sendVerificationEmail: () => Promise<void>;
  refreshUser: () => Promise<boolean>;
  updateProfileData: (data: { nombre?: string; moneda?: string; tasa?: number }) => Promise<void>;
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

      // Verificación de email obligatoria (excepto admins y Google)
      if (!firebaseUser.emailVerified && userData.rol !== 'admin') {
        setUser({ ...firebaseUser, ...userData } as FirebaseUserWithData);
        setLoading(false);
        throw new Error("Verificá tu correo antes de continuar. Revisá tu bandeja de entrada.");
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

  /**
   * Envía el correo de verificación via Cloud Function (patrón enviarCorreoRecuperacion).
   * Funciona incluso sin sesión activa, solo necesita el email.
   */
  const sendVerificationEmail = async (): Promise<void> => {
    const email = auth.currentUser?.email;
    const nombre = user?.nombre;
    if (!email) throw new Error('No hay correo asociado a la sesión');
    const functions = getFunctions();
    const fn = httpsCallable(functions, 'enviarCorreoVerificacion');
    await fn({ email, nombre });
  };

  /**
   * Recarga el usuario de Firebase Auth y devuelve si ya verificó el correo.
   */
  const refreshUser = async (): Promise<boolean> => {
    const current = auth.currentUser;
    if (!current) return false;
    await current.reload();
    const verified = auth.currentUser?.emailVerified ?? false;
    if (verified && user) {
      setUser({ ...user, emailVerified: verified } as FirebaseUserWithData);
    }
    return verified;
  };

  const loginWithGoogle = async (): Promise<void> => {
    try {
      setLoading(true);
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const { user: firebaseUser } = result;
      const ref = doc(db, 'usuarios', firebaseUser.uid);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        const profile = {
          nombre: firebaseUser.displayName || 'Usuario Google',
          correo: firebaseUser.email,
          rol: 'usuario' as const,
          estado: 'activo' as const,
          moneda: 'COP',
          tasa: 1,
          activoHasta: null,
          createdAt: new Date().toISOString(),
        };
        await setDoc(ref, profile);
        setUser({ ...firebaseUser, ...profile } as FirebaseUserWithData);
      } else {
        const userData = snap.data() as Record<string, unknown>;
        if (userData.estado === 'inactivo') {
          await signOut(auth);
          setLoading(false);
          throw new Error('Tu cuenta está inactiva. Contacta al administrador.');
        }
        if (isExpired(userData.activoHasta)) {
          await signOut(auth);
          setLoading(false);
          throw new Error('Tu cuenta ha vencido. Contacta al administrador.');
        }
        setUser({ ...firebaseUser, ...userData } as FirebaseUserWithData);
      }
      setLoading(false);
    } catch (error: unknown) {
      setLoading(false);
      const err = error as { code?: string; message?: string };
      if (err.code === 'auth/account-exists-with-different-credential') {
        throw new Error('Ya existe una cuenta con este correo electrónico. Iniciá sesión con tu correo y contraseña.');
      }
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
        activoHasta: null,
        createdAt: new Date().toISOString(),
      };

      await setDoc(doc(db, 'usuarios', uid), profile);
      setUser({ ...userCredential.user, ...profile } as FirebaseUserWithData);

      // Enviar email de verificación con template personalizado (via Cloud Function)
      // Fallback al nativo de Firebase si la callable falla
      try {
        await sendVerificationEmail();
      } catch (err) {
        console.warn('No se pudo enviar email de verificación personalizado, usando nativo:', err);
        try {
          await sendEmailVerification(userCredential.user);
        } catch (err2) {
          console.warn('No se pudo enviar email de verificación nativo:', err2);
        }
      }

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

  const updateProfileData = async (data: { nombre?: string; moneda?: string; tasa?: number }): Promise<void> => {
    if (!user?.uid) throw new Error("No hay sesión activa");
    await updateDoc(doc(db, "usuarios", user.uid), data);
    setUser(prev => prev ? { ...prev, ...data } as FirebaseUserWithData : null);
  };

  const updateUserEmail = async (newEmail: string, currentPassword: string): Promise<void> => {
    if (!auth.currentUser) throw new Error("No hay sesión activa");
    await reauthenticate(currentPassword);
    await updateEmail(auth.currentUser, newEmail);
    await updateDoc(doc(db, "usuarios", auth.currentUser.uid), { correo: newEmail });
    // updateEmail resetea emailVerified a false → el usuario debe re-verificar
    setUser(prev => prev ? { ...prev, correo: newEmail, emailVerified: false } as FirebaseUserWithData : null);
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
    <AuthContext.Provider value={{ user, login, loginWithGoogle, register, logout, loading, sendVerificationEmail, refreshUser, updateProfileData, updateUserEmail, updateUserPassword }}>
      {children}
    </AuthContext.Provider>
  );
}
