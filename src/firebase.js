import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

// ✅ Configuración del proyecto Firebase
const firebaseConfig = {
  apiKey: "AIzaSyC9gPD-_TY0peahoTrmRZcGCG8Cl4l_edQ",
  authDomain: "streamcontrol-10837.firebaseapp.com",
  projectId: "streamcontrol-10837",
  storageBucket: "streamcontrol-10837.appspot.com",
  messagingSenderId: "149009813939",
  appId: "1:149009813939:web:6b8fb77e9415bbae0abbc6",
  measurementId: "G-87R3DYVTQS"
};

// ✅ Inicialización principal
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

// ✅ Instancia secundaria (para crear usuarios sin cerrar sesión actual)
export const secondaryApp = initializeApp(firebaseConfig, "Secondary");
export const secondaryAuth = getAuth(secondaryApp);

export default app;