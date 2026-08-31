import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, limit, type DocumentData } from 'firebase/firestore';

export interface AnuncioGlobal {
  id: string;
  titulo: string;
  mensaje: string;
  tipo: 'comunicado' | 'promocion' | 'vencimiento' | 'novedad' | string;
  linkBoton?: string;
  textoBoton?: string;
  fecha?: string;
  createdAt?: string;
  activo?: boolean;
  canales?: {
    inApp?: boolean;
    banner?: boolean;
    email?: boolean;
  };
  audiencia?: 'todos' | 'activos' | 'por_vencer' | string;
}

export function useAnunciosGlobales() {
  const [anuncios, setAnuncios] = useState<AnuncioGlobal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubCol: (() => void) | undefined;

    try {
      // Escuchar la colección 'anunciosGlobales'
      const colRef = collection(db, 'anunciosGlobales');
      const q = query(colRef, limit(20));

      unsubCol = onSnapshot(
        q,
        (snap) => {
          const items: AnuncioGlobal[] = [];
          snap.forEach((d) => {
            const data = d.data() as DocumentData;
            if (data.activo !== false) {
              items.push({
                id: d.id,
                titulo: data.titulo || 'Comunicado Oficial',
                mensaje: data.mensaje || '',
                tipo: data.tipo || 'comunicado',
                linkBoton: data.linkBoton || '',
                textoBoton: data.textoBoton || '',
                fecha: data.fecha || data.createdAt || '',
                createdAt: data.createdAt || data.fecha || '',
                activo: data.activo !== false,
                canales: data.canales || { inApp: true },
                audiencia: data.audiencia || 'todos',
              });
            }
          });

          // Ordenar por fecha descendente
          items.sort((a, b) => {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return dateB - dateA;
          });

          setAnuncios(items);
          setLoading(false);
        },
        (err) => {
          console.warn('Error escuchando anunciosGlobales:', err);
          setLoading(false);
        }
      );
    } catch (e) {
      console.warn('Error configurando listener de anunciosGlobales:', e);
      setLoading(false);
    }

    return () => {
      if (unsubCol) unsubCol();
    };
  }, []);

  return { anuncios, loading };
}
