export const FEATURE_LABELS: Record<string, string> = {
  clienteLimit: 'Límite de clientes',
  puedeUsarTelegram: 'Notificaciones Telegram',
  puedeVerReportesAvanzados: 'Reportes Avanzados',
  puedeExportarExcel: 'Exportar a Excel',
  puedeVerDashboardEjecutivo: 'Dashboard Ejecutivo',
  tieneSoportePrioritario: 'Soporte Prioritario',
  tieneSoporte247: 'Soporte 24/7',
};

export const PLAN_LABELS: Record<string, string> = {
  Starter: 'Starter',
  Professional: 'Professional',
  Enterprise: 'Enterprise',
};

const PLAN_UPGRADE_TARGET: Record<string, string> = {
  Starter: 'Professional',
  Professional: 'Enterprise',
};

export function getUpgradeTarget(planName: string): string | null {
  return PLAN_UPGRADE_TARGET[planName] ?? null;
}
