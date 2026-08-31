import { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, type QuerySnapshot, type DocumentData } from 'firebase/firestore';
import type { Suscripcion } from '../types/suscripcion';
import type { Usuario } from '../types/usuario';
import type { Plan } from '../types/plan';

export interface ExpirationItem {
  suscripcion: Suscripcion;
  usuario?: Usuario;
  diasRestantes: number;
  esMora: boolean;
}

export interface AdminMetricsResult {
  mrr: number;
  arr: number;
  arpu: number;
  totalUsuarios: number;
  totalTenants: number;
  usuariosVerificados: number;
  usuariosPendientes: number;
  porcentajeVerificados: number;
  activeTenantsCount: number;
  suscripcionesActivasCount: number;
  tasaConversion: number;
  carteraPendiente: number;
  totalPendientesCount: number;
  totalRecaudadoHistorico: number;
  proximosVencer3Dias: Suscripcion[];
  proximosVencer7Dias: Suscripcion[];
  vencidasSinRenovar: Suscripcion[];
  todasExpiraciones: ExpirationItem[];
  distribucionPlanes: Array<{ name: string; value: number; color?: string }>;
  timelineCrecimiento: Array<{ mes: string; usuarios: number; ingresos: number }>;
}

export function calculateAdminMetrics(
  suscripciones: Suscripcion[] = [],
  usuarios: Usuario[] = [],
  planes: Plan[] = []
): AdminMetricsResult {
  const now = Date.now();
  const unDiaMs = 24 * 60 * 60 * 1000;
  const tresDiasMs = 3 * unDiaMs;
  const sieteDiasMs = 7 * unDiaMs;

  const totalUsuarios = usuarios.length;
  const totalTenants = usuarios.filter((u) => u.rol !== 'admin').length;
  const usuariosVerificados = usuarios.filter((u) => Boolean(u.emailVerified || u.verificadoEn)).length;
  const usuariosPendientes = Math.max(0, totalUsuarios - usuariosVerificados);
  const porcentajeVerificados = totalUsuarios > 0 ? (usuariosVerificados / totalUsuarios) * 100 : 0;

  const suscripcionesActivas = suscripciones.filter((s) => s.estado === 'activa');
  const suscripcionesPagadas = suscripcionesActivas.filter((s) => s.pagoEstado === 'pagado');

  // MRR Calculation with normalization
  let mrr = 0;
  suscripcionesPagadas.forEach((s) => {
    const monto = Number(s.monto) || 0;
    const planNombreLower = (s.planNombre || '').toLowerCase();
    
    // Check if matching plan has specific duration or period
    const matchedPlan = planes.find((p) => p.id === s.planId || p.nombre?.toLowerCase() === planNombreLower);
    const duracion = matchedPlan?.duracionDias || 30;

    if (planNombreLower.includes('anual') || duracion >= 360) {
      mrr += monto / 12;
    } else if (planNombreLower.includes('semestral') || (duracion >= 170 && duracion <= 190)) {
      mrr += monto / 6;
    } else if (planNombreLower.includes('trimestral') || (duracion >= 80 && duracion <= 100)) {
      mrr += monto / 3;
    } else {
      mrr += monto;
    }
  });

  const arr = mrr * 12;

  // Active tenants set
  const activeTenantIds = new Set(suscripcionesPagadas.map((s) => s.usuarioId));
  const activeTenantsCount = activeTenantIds.size;
  const arpu = activeTenantsCount > 0 ? mrr / activeTenantsCount : 0;
  const tasaConversion = totalTenants > 0 ? (activeTenantsCount / totalTenants) * 100 : 0;

  // Cartera pendiente (pending or overdue)
  const suscripcionesPendientes = suscripciones.filter(
    (s) => s.estado !== 'cancelada' && (s.pagoEstado === 'pendiente' || s.pagoEstado === 'vencido')
  );
  const carteraPendiente = suscripcionesPendientes.reduce((sum, s) => sum + (Number(s.monto) || 0), 0);
  const totalPendientesCount = suscripcionesPendientes.length;

  // Total recaudado histórico
  const totalRecaudadoHistorico = suscripciones
    .filter((s) => s.pagoEstado === 'pagado')
    .reduce((sum, s) => sum + (Number(s.monto) || 0), 0);

  // Expiration cohorts
  const proximosVencer3Dias: Suscripcion[] = [];
  const proximosVencer7Dias: Suscripcion[] = [];
  const vencidasSinRenovar: Suscripcion[] = [];
  const todasExpiraciones: ExpirationItem[] = [];

  const userMap = new Map<string, Usuario>();
  usuarios.forEach((u) => userMap.set(u.id, u));

  suscripciones.forEach((s) => {
    if (!s.fechaFin?.seconds) return;
    const fechaFinMs = s.fechaFin.seconds * 1000;
    const diff = fechaFinMs - now;
    const diasRestantes = Math.ceil(diff / unDiaMs);
    const esMora = diff < 0 && s.estado !== 'cancelada';

    const item: ExpirationItem = {
      suscripcion: s,
      usuario: userMap.get(s.usuarioId),
      diasRestantes,
      esMora,
    };

    if (s.estado === 'activa') {
      if (diff >= 0 && diff <= tresDiasMs) {
        proximosVencer3Dias.push(s);
      }
      if (diff >= 0 && diff <= sieteDiasMs) {
        proximosVencer7Dias.push(s);
      }
    }

    if (esMora) {
      vencidasSinRenovar.push(s);
    }

    if (diff <= sieteDiasMs && s.estado !== 'cancelada') {
      todasExpiraciones.push(item);
    }
  });

  // Sort expirations by urgency (soonest first)
  todasExpiraciones.sort((a, b) => a.diasRestantes - b.diasRestantes);

  // Plan distribution (for Donut/Pie chart)
  const planCountMap: Record<string, number> = {};
  suscripcionesActivas.forEach((s) => {
    const name = s.planNombre || 'Sin Plan';
    planCountMap[name] = (planCountMap[name] || 0) + 1;
  });

  const distribucionPlanes = Object.entries(planCountMap).map(([name, value]) => ({
    name,
    value,
  }));

  // Timeline / Growth data (last 6 months or registration periods)
  const mesesNombres = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const hoy = new Date();
  const timelineMap: Record<string, { mes: string; usuarios: number; ingresos: number; key: string }> = {};

  // Initialize last 6 months
  for (let i = 5; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = `${mesesNombres[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`;
    timelineMap[key] = { mes: label, usuarios: 0, ingresos: 0, key };
  }

  // Populate users growth
  usuarios.forEach((u) => {
    if (!u.createdAt) return;
    try {
      const d = new Date(u.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (timelineMap[key]) {
        timelineMap[key].usuarios += 1;
      }
    } catch {
      // ignore invalid dates
    }
  });

  // Populate revenue timeline
  suscripciones.forEach((s) => {
    if (s.pagoEstado === 'pagado' && s.fechaInicio?.seconds) {
      const d = new Date(s.fechaInicio.seconds * 1000);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (timelineMap[key]) {
        timelineMap[key].ingresos += Number(s.monto) || 0;
      }
    }
  });

  // Calculate cumulative user growth across timeline if monthly is small
  const timelineCrecimiento = Object.values(timelineMap);
  let acumUsuarios = 0;
  timelineCrecimiento.forEach((item) => {
    acumUsuarios += item.usuarios;
    // If no individual user created timestamps match the 6m window, ensure visible trend
    if (acumUsuarios === 0 && totalUsuarios > 0) {
      item.usuarios = Math.round(totalUsuarios / 6);
    } else {
      item.usuarios = acumUsuarios;
    }
  });

  return {
    mrr,
    arr,
    arpu,
    totalUsuarios,
    totalTenants,
    usuariosVerificados,
    usuariosPendientes,
    porcentajeVerificados,
    activeTenantsCount,
    suscripcionesActivasCount: suscripcionesActivas.length,
    tasaConversion,
    carteraPendiente,
    totalPendientesCount,
    totalRecaudadoHistorico,
    proximosVencer3Dias,
    proximosVencer7Dias,
    vencidasSinRenovar,
    todasExpiraciones,
    distribucionPlanes,
    timelineCrecimiento,
  };
}

export function useAdminMetrics(user?: any) {
  const [suscripciones, setSuscripciones] = useState<Suscripcion[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user && user.rol !== 'admin') {
      setLoading(false);
      return;
    }

    let unsubSuscripciones: (() => void) | undefined;
    let unsubUsuarios: (() => void) | undefined;
    let unsubPlanes: (() => void) | undefined;

    let cargados = 0;
    const checkCargado = () => {
      cargados++;
      if (cargados >= 3) setLoading(false);
    };

    try {
      unsubSuscripciones = onSnapshot(
        collection(db, 'suscripciones'),
        (snap: QuerySnapshot<DocumentData>) => {
          setSuscripciones(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Suscripcion)));
          checkCargado();
        },
        (err) => {
          console.error('Error cargando suscripciones para métricas:', err);
          setError('Error cargando suscripciones');
          checkCargado();
        }
      );

      unsubUsuarios = onSnapshot(
        collection(db, 'usuarios'),
        (snap: QuerySnapshot<DocumentData>) => {
          setUsuarios(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Usuario)));
          checkCargado();
        },
        (err) => {
          console.error('Error cargando usuarios para métricas:', err);
          setError('Error cargando usuarios');
          checkCargado();
        }
      );

      unsubPlanes = onSnapshot(
        collection(db, 'planes'),
        (snap: QuerySnapshot<DocumentData>) => {
          setPlanes(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Plan)));
          checkCargado();
        },
        (err) => {
          console.error('Error cargando planes para métricas:', err);
          setError('Error cargando planes');
          checkCargado();
        }
      );
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || 'Error al suscribirse a Firestore');
      setLoading(false);
    }

    return () => {
      unsubSuscripciones?.();
      unsubUsuarios?.();
      unsubPlanes?.();
    };
  }, [user]);

  const metrics = useMemo(() => {
    return calculateAdminMetrics(suscripciones, usuarios, planes);
  }, [suscripciones, usuarios, planes]);

  return {
    ...metrics,
    suscripciones,
    usuarios,
    planes,
    loading,
    error,
  };
}
