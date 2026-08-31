import { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, type QuerySnapshot, type DocumentData, Timestamp } from 'firebase/firestore';
import type { Suscripcion } from '../types/suscripcion';
import type { Usuario } from '../types/usuario';
import type { Plan } from '../types/plan';
import { parseDateToMs, toFirestoreTimestamp } from '../utils/dateUtils';

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
  // Exclude admin accounts from tenant counts and metrics
  const adminUids = new Set(
    usuarios.filter((u) => u.rol === 'admin').map((u) => u.id)
  );
  const tenants = usuarios.filter((u) => u.rol !== 'admin');
  const totalTenants = tenants.length;

  const usuariosVerificados = usuarios.filter(
    (u) => Boolean(u.emailVerified || u.verificadoEn)
  ).length;
  const usuariosPendientes = Math.max(0, totalUsuarios - usuariosVerificados);
  const porcentajeVerificados =
    totalUsuarios > 0 ? (usuariosVerificados / totalUsuarios) * 100 : 0;

  const userMap = new Map<string, Usuario>();
  usuarios.forEach((u) => userMap.set(u.id, u));

  // Filter subscriptions to only include tenants (exclude super admins)
  const tenantSuscripciones = suscripciones.filter(
    (s) => !adminUids.has(s.usuarioId) && userMap.get(s.usuarioId)?.rol !== 'admin'
  );

  const suscripcionesActivas = tenantSuscripciones.filter((s) => s.estado === 'activa');
  const suscripcionesPagadas = suscripcionesActivas.filter((s) => s.pagoEstado === 'pagado');

  // Track active tenant IDs
  const activeTenantIds = new Set<string>();
  const planCountMap: Record<string, number> = {};
  let mrr = 0;

  // Helper to normalize MRR based on plan duration/period
  const getNormalizedMrr = (monto: number, planNombre = '', duracionDias = 30): number => {
    const planLower = planNombre.toLowerCase();
    if (planLower.includes('anual') || duracionDias >= 360) {
      return monto / 12;
    } else if (planLower.includes('semestral') || (duracionDias >= 170 && duracionDias <= 190)) {
      return monto / 6;
    } else if (planLower.includes('trimestral') || (duracionDias >= 80 && duracionDias <= 100)) {
      return monto / 3;
    }
    return monto;
  };

  // Helper to find matching plan in planes catalog
  const findMatchingPlan = (planIdOrName?: string): Plan | undefined => {
    if (!planIdOrName) return undefined;
    const clean = planIdOrName.trim().toLowerCase();
    return planes.find(
      (p) =>
        p.id === planIdOrName ||
        p.nombre?.toLowerCase() === clean ||
        p.nombre?.toLowerCase().includes(clean) ||
        clean.includes(p.nombre?.toLowerCase())
    );
  };

  // 1. Calculate MRR & active tenants from modern `suscripciones`
  suscripcionesPagadas.forEach((s) => {
    const monto = Number(s.monto) || 0;
    const planNombre = s.planNombre || 'Plan Estándar';
    const matchedPlan = findMatchingPlan(s.planId) || findMatchingPlan(s.planNombre);
    const duracion = matchedPlan?.duracionDias || 30;

    mrr += getNormalizedMrr(monto, planNombre, duracion);
    activeTenantIds.add(s.usuarioId);
    planCountMap[planNombre] = (planCountMap[planNombre] || 0) + 1;
  });

  // Track tenants that already have an active subscription
  const tenantsWithActiveSub = new Set(suscripcionesActivas.map((s) => s.usuarioId));

  // 2. Fallback: Check legacy users who do NOT have an active doc in `suscripciones`
  tenants.forEach((u) => {
    if (tenantsWithActiveSub.has(u.id)) return;

    // Check if legacy user is active
    const activoHastaMs = parseDateToMs(u.activoHasta);
    const isActivoPorFecha = activoHastaMs !== null && activoHastaMs > now;
    const isActivoPorEstado = u.estado === 'activo';

    if (isActivoPorEstado || isActivoPorFecha) {
      const matchedPlan = findMatchingPlan(u.plan);
      const planNombre = matchedPlan?.nombre || u.plan || 'Starter';
      const monto = matchedPlan ? Number(matchedPlan.precio) || 0 : 0;
      const duracion = matchedPlan?.duracionDias || 30;

      if (monto > 0) {
        mrr += getNormalizedMrr(monto, planNombre, duracion);
      }

      activeTenantIds.add(u.id);
      planCountMap[planNombre] = (planCountMap[planNombre] || 0) + 1;
    }
  });

  const arr = mrr * 12;
  const activeTenantsCount = activeTenantIds.size;
  const arpu = activeTenantsCount > 0 ? mrr / activeTenantsCount : 0;
  const tasaConversion = totalTenants > 0 ? (activeTenantsCount / totalTenants) * 100 : 0;

  // Cartera pendiente (pending or overdue subscriptions)
  const suscripcionesPendientes = tenantSuscripciones.filter(
    (s) => s.estado !== 'cancelada' && (s.pagoEstado === 'pendiente' || s.pagoEstado === 'vencido')
  );
  const carteraPendiente = suscripcionesPendientes.reduce(
    (sum, s) => sum + (Number(s.monto) || 0),
    0
  );
  const totalPendientesCount = suscripcionesPendientes.length;

  // Total recaudado histórico
  const totalRecaudadoHistorico = tenantSuscripciones
    .filter((s) => s.pagoEstado === 'pagado')
    .reduce((sum, s) => sum + (Number(s.monto) || 0), 0);

  // Expiration cohorts & Action Center
  const proximosVencer3Dias: Suscripcion[] = [];
  const proximosVencer7Dias: Suscripcion[] = [];
  const vencidasSinRenovar: Suscripcion[] = [];
  const todasExpiraciones: ExpirationItem[] = [];
  const usersWithExpirationProcessed = new Set<string>();

  // A. Process from `suscripciones` collection
  tenantSuscripciones.forEach((s) => {
    const fechaFinMs = parseDateToMs(s.fechaFin);
    if (!fechaFinMs) return;

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

    usersWithExpirationProcessed.add(s.usuarioId);
  });

  // B. Fallback: Process legacy tenants without a subscription doc in `suscripciones`
  tenants.forEach((u) => {
    if (usersWithExpirationProcessed.has(u.id)) return;
    if (!u.activoHasta) return;

    const activoHastaMs = parseDateToMs(u.activoHasta);
    if (!activoHastaMs) return;

    const diff = activoHastaMs - now;
    const diasRestantes = Math.ceil(diff / unDiaMs);
    const esMora = diff < 0 && u.estado !== 'inactivo';

    const matchedPlan = findMatchingPlan(u.plan);
    const planNombre = matchedPlan?.nombre || u.plan || 'Plan Activo';
    const monto = matchedPlan?.precio || 0;

    const synthSub: Suscripcion = {
      id: `legacy-${u.id}`,
      usuarioId: u.id,
      usuarioNombre: u.nombre || u.correo || u.email || 'Usuario',
      planId: matchedPlan?.id || 'legacy-plan',
      planNombre,
      fechaInicio: (toFirestoreTimestamp(u.createdAt) || Timestamp.now()) as Timestamp,
      fechaFin: (toFirestoreTimestamp(u.activoHasta) || Timestamp.now()) as Timestamp,
      estado: u.estado === 'inactivo' ? 'expirada' : (diff < 0 ? 'expirada' : 'activa'),
      pagoEstado: diff < 0 ? 'vencido' : 'pendiente',
      monto,
      createdAt: (toFirestoreTimestamp(u.createdAt) || Timestamp.now()) as Timestamp,
      updatedAt: Timestamp.now(),
    };

    const item: ExpirationItem = {
      suscripcion: synthSub,
      usuario: u,
      diasRestantes,
      esMora,
    };

    if (u.estado === 'activo') {
      if (diff >= 0 && diff <= tresDiasMs) {
        proximosVencer3Dias.push(synthSub);
      }
      if (diff >= 0 && diff <= sieteDiasMs) {
        proximosVencer7Dias.push(synthSub);
      }
    }

    if (esMora) {
      vencidasSinRenovar.push(synthSub);
    }

    if (diff <= sieteDiasMs && u.estado !== 'inactivo') {
      todasExpiraciones.push(item);
    }
  });

  // Sort expirations by urgency (soonest / most overdue first)
  todasExpiraciones.sort((a, b) => a.diasRestantes - b.diasRestantes);

  // Plan distribution for Donut Chart
  const distribucionPlanes = Object.entries(planCountMap).map(([name, value]) => ({
    name,
    value,
  }));

  // Timeline / Growth data (last 6 months)
  const mesesNombres = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const hoy = new Date();
  const timelineMap: Record<string, { mes: string; usuarios: number; ingresos: number; key: string }> = {};

  for (let i = 5; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = `${mesesNombres[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`;
    timelineMap[key] = { mes: label, usuarios: 0, ingresos: 0, key };
  }

  // Populate users growth
  usuarios.forEach((u) => {
    const createdMs = parseDateToMs(u.createdAt);
    if (!createdMs) return;
    const d = new Date(createdMs);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (timelineMap[key]) {
      timelineMap[key].usuarios += 1;
    }
  });

  // Populate revenue timeline
  tenantSuscripciones.forEach((s) => {
    if (s.pagoEstado === 'pagado') {
      const inicioMs = parseDateToMs(s.fechaInicio) || parseDateToMs(s.createdAt);
      if (!inicioMs) return;
      const d = new Date(inicioMs);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (timelineMap[key]) {
        timelineMap[key].ingresos += Number(s.monto) || 0;
      }
    }
  });

  // Calculate cumulative user growth across timeline
  const timelineCrecimiento = Object.values(timelineMap);
  let acumUsuarios = 0;
  timelineCrecimiento.forEach((item) => {
    acumUsuarios += item.usuarios;
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
    suscripcionesActivasCount: activeTenantsCount,
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
