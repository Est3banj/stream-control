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
import { callFunction } from '../lib/apiClient';
import type { UserCredential } from 'firebase/auth';
import type { FirebaseUserWithData } from '../types/usuario';

const fireAndForget = (fn: string, data?: unknown): void => {
  callFunction(fn, data).catch(() => callFunction(fn, data).catch(() => undefined));
};

interface AuthContextValue {
  user: FirebaseUserWithData | null;
  login: (email: string, password: string) => Promise<UserCredential>;
  loginWithGoogle: () => Promise<void>;
  register: (data: { nombre: string; correo: string; password: string; moneda: string; tasa: number }) => Promise<UserCredential>;
  logout: () => Promise<void>;
  loading: boolean;
  sendVerificationEmail: (overrideEmail?: string, overrideNombre?: string) => Promise<void>;
  enviarCodigoOTP: (overrideEmail?: string, overrideNombre?: string) => Promise<void>;
  verificarCodigo: (codigo: string, overrideEmail?: string) => Promise<void>;
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
        try {
          if (typeof firebaseUser.reload === 'function') {
            await firebaseUser.reload().catch(() => undefined);
          }
        } catch {
          // ignore reload error
        }

        try {
          const ref = doc(db, "usuarios", firebaseUser.uid);
          const snap = await getDoc(ref);
          const userData = snap.exists() ? (snap.data() as Record<string, unknown>) : {};

          // 🔒 Cuenta vencida → cerrar sesión automáticamente
          if (isExpired(userData.activoHasta)) {
            await signOut(auth);
            setUser(null);
            setLoading(false);
            return;
          }

          const isVerified = Boolean(
            firebaseUser.emailVerified ||
            userData.emailVerified === true ||
            userData.emailVerified === 'true' ||
            userData.rol === 'admin'
          );

          setUser({
            ...firebaseUser,
            ...userData,
            emailVerified: isVerified,
          } as FirebaseUserWithData);
        } catch (err) {
          console.error("Error cargando perfil en onAuthStateChanged:", err);
          setUser({
            ...firebaseUser,
            emailVerified: Boolean(firebaseUser.emailVerified),
          } as FirebaseUserWithData);
        }
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

      try {
        if (typeof firebaseUser.reload === 'function') {
          await firebaseUser.reload().catch(() => undefined);
        }
      } catch {
        // ignore reload error
      }

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
      const isEmailVerified = Boolean(
        firebaseUser.emailVerified ||
        userData.emailVerified === true ||
        userData.emailVerified === 'true' ||
        userData.rol === 'admin'
      );

      if (!isEmailVerified) {
        setUser({ ...firebaseUser, ...userData, emailVerified: false } as FirebaseUserWithData);
        setLoading(false);
        throw new Error("Verificá tu correo antes de continuar. Revisá tu bandeja de entrada.");
      }

      setUser({
        ...firebaseUser,
        ...userData,
        emailVerified: true,
      } as FirebaseUserWithData);
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
  const sendVerificationEmail = async (overrideEmail?: string, overrideNombre?: string): Promise<void> => {
    const email = overrideEmail || auth.currentUser?.email || user?.correo;
    const nombre = overrideNombre || user?.nombre || 'Usuario';
    if (!email) throw new Error('No hay correo asociado a la sesión');
    await callFunction('enviarCorreoVerificacion', { email, nombre });
  };

  /**
   * Envía el código OTP de 6 dígitos via Cloud Function /api/enviarCodigoOTP.
   */
  const enviarCodigoOTP = async (overrideEmail?: string, overrideNombre?: string): Promise<void> => {
    const email = overrideEmail || auth.currentUser?.email || user?.correo;
    const nombre = overrideNombre || user?.nombre || 'Usuario';
    if (!email) throw new Error('No hay correo asociado a la sesión');
    await callFunction('enviarCodigoOTP', { email, nombre });
  };

  /**
   * Valida el código OTP de 6 dígitos via Cloud Function /api/verificarCodigoOTP
   * y recarga el token y perfil del usuario.
   */
  const verificarCodigo = async (codigo: string, overrideEmail?: string): Promise<void> => {
    const email = overrideEmail || auth.currentUser?.email || user?.correo;
    if (!email) throw new Error('No hay correo asociado a la sesión');
    await callFunction('verificarCodigoOTP', { email, codigo });

    // Recargar Firebase Auth y refrescar claims
    try {
      if (auth.currentUser?.reload) {
        await auth.currentUser.reload();
      }
      if (auth.currentUser?.getIdToken) {
        await auth.currentUser.getIdToken(true);
      }
    } catch (err) {
      console.warn('Advertencia al refrescar auth.currentUser tras verificar OTP:', err);
    }

    // Actualizar estado reactivo local
    setUser((prev) => (prev ? ({ ...prev, emailVerified: true } as FirebaseUserWithData) : null));
  };

  /**
   * Recarga el usuario de Firebase Auth y devuelve si ya verificó el correo.
   * Protegido contra llamadas en estados no autenticados o con tokens stale/inválidos (400 Identity Toolkit).
   */
  const refreshUser = async (): Promise<boolean> => {
    const current = auth.currentUser;
    if (!current || !current.uid) return false;

    try {
      if (typeof current.reload === 'function') {
        await current.reload();
      }
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      if (
        error?.code === 'auth/user-not-found' ||
        error?.code === 'auth/user-token-expired' ||
        error?.code === 'auth/invalid-user-token' ||
        error?.code === 'auth/network-request-failed' ||
        error?.message?.includes('INVALID_ID_TOKEN') ||
        error?.message?.includes('TOKEN_EXPIRED')
      ) {
        console.info('refreshUser: sesión no lista o token no válido (' + (error.code || error.message || 'unknown') + ')');
        return false;
      }
      console.warn('refreshUser: advertencia al recargar Firebase Auth user:', err);
    }

    let isVerified = auth.currentUser?.emailVerified ?? false;

    // Backup: Si Firebase Auth aún no lo marca pero Firestore sí
    if (!isVerified && current.uid) {
      try {
        const snap = await getDoc(doc(db, "usuarios", current.uid));
        if (snap.exists()) {
          const data = snap.data() as Record<string, unknown>;
          if (data?.emailVerified === true || data?.emailVerified === 'true' || data?.rol === 'admin') {
            isVerified = true;
          }
        }
      } catch (err) {
        console.warn('Error consultando estado en Firestore:', err);
      }
    }

    if (isVerified) {
      setUser(prev => prev ? { ...prev, emailVerified: true } as FirebaseUserWithData : null);
    }
    return isVerified;
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

      // Post-write trigger v2 onNuevoUsuario → fire-and-forget (1 reintento, no bloquea)
      fireAndForget('onNuevoUsuario');

      // Enviar código OTP de verificación con template personalizado (via Cloud Function)
      try {
        await enviarCodigoOTP(data.correo, data.nombre);
      } catch (err) {
        console.error('Error al enviar código OTP de verificación inicial:', err);
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
      const ref = await addDoc(collection(db, 'notificacionesEmail'), {
        tipo: 'email_changed',
        nuevoCorreo: newEmail,
        nombre: user?.nombre || 'Usuario',
        uid: auth.currentUser.uid,
        fecha: new Date().toISOString(),
      });
      // Post-write trigger v2 onNotificacionEmail → fire-and-forget (1 reintento, no bloquea)
      fireAndForget('onNotificacionEmail', { notificacionId: ref.id });
    } catch (e) {
      console.error('Error encolando notificación email:', e);
    }
  };

  const updateUserPassword = async (newPassword: string, currentPassword: string): Promise<void> => {
    if (!auth.currentUser) throw new Error("No hay sesión activa");
    await reauthenticate(currentPassword);
    await updatePassword(auth.currentUser, newPassword);
    try {
      const ref = await addDoc(collection(db, 'notificacionesEmail'), {
        tipo: 'password_changed',
        nombre: user?.nombre || 'Usuario',
        uid: auth.currentUser.uid,
        fecha: new Date().toISOString(),
      });
      // Post-write trigger v2 onNotificacionEmail → fire-and-forget (1 reintento, no bloquea)
      fireAndForget('onNotificacionEmail', { notificacionId: ref.id });
    } catch (e) {
      console.error('Error encolando notificación email:', e);
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, loginWithGoogle, register, logout, loading, sendVerificationEmail, enviarCodigoOTP, verificarCodigo, refreshUser, updateProfileData, updateUserEmail, updateUserPassword }}>
      {children}
    </AuthContext.Provider>
  );
}
