import React, { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "../firebase";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

const AuthContext = createContext();
export function useAuth() {
  return useContext(AuthContext);
}

/**
 * Verifica si activoHasta está vencido.
 * Soporta string YYYY-MM-DD y Firestore Timestamp.
 */
function isExpired(activoHasta) {
  if (!activoHasta) return false; // sin fecha = sin restricción

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  let fechaLimite;

  if (typeof activoHasta === "string") {
    fechaLimite = new Date(activoHasta);
  } else if (typeof activoHasta.toDate === "function") {
    // Firestore Timestamp
    fechaLimite = activoHasta.toDate();
  } else if (activoHasta instanceof Date) {
    fechaLimite = activoHasta;
  } else {
    return false; // formato desconocido, no bloquear
  }

  fechaLimite.setHours(0, 0, 0, 0);
  return fechaLimite < hoy;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const ref = doc(db, "usuarios", firebaseUser.uid);
        const snap = await getDoc(ref);
        const userData = snap.exists() ? snap.data() : {};

        // 🔒 Cuenta vencida → cerrar sesión automáticamente
        if (isExpired(userData.activoHasta)) {
          await signOut(auth);
          // signOut re-dispara onAuthStateChanged con null → setUser(null), loading=false
          return;
        }

        setUser({ ...firebaseUser, ...userData });
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // 🔹 Corrección importante: esperar la autenticación antes del navigate
  const login = async (email, password) => {
    try {
      setLoading(true);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      if (!userCredential || !userCredential.user) {
        throw new Error("Error al iniciar sesión. Intente nuevamente.");
      }

      const firebaseUser = userCredential.user;

      // Consultar datos del usuario en Firestore
      const ref = doc(db, "usuarios", firebaseUser.uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await signOut(auth);
        setLoading(false);
        throw new Error("Usuario no registrado en la base de datos");
      }
      const userData = snap.data();

      // 🔒 Verificar estado del usuario
      if (userData.estado === "inactivo") {
        await signOut(auth);
        setLoading(false);
        throw new Error("Tu cuenta está inactiva. Contacta al administrador.");
      }

      // 🔒 Verificar vencimiento de la cuenta
      if (isExpired(userData.activoHasta)) {
        await signOut(auth);
        setLoading(false);
        throw new Error("Tu cuenta ha vencido. Contacta al administrador para renovar.");
      }

      setUser({ ...firebaseUser, ...userData });
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