export const ESTADO_BADGES: Record<string, { label: string; class: string }> = {
  disponible: { label: 'Disponible', class: 'bg-green-100 text-green-700' },
  asignada: { label: 'Asignada', class: 'bg-blue-100 text-blue-700' },
  expirada: { label: 'Expirada', class: 'bg-red-100 text-red-700' },
};

export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return email;
  const [name, domain] = email.split('@');
  const masked = name.charAt(0) + '*'.repeat(Math.max(name.length - 2, 1)) + name.charAt(name.length - 1);
  return `${masked}@${domain}`;
}
