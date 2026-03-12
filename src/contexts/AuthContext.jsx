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

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const ref = doc(db, "usuarios", firebaseUser.uid);
        const snap = await getDoc(ref);
        const userData = snap.exists() ? snap.data() : {};
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
      const userData = snap.exists() ? snap.data() : {};

      // 🔒 Verificar estado del usuario
      if (userData.estado === "inactivo") {
        await signOut(auth);
        setLoading(false);
        throw new Error("Tu cuenta está inactiva. Contacta al administrador.");
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