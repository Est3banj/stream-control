export type CategoriaTutorial = 'ventas' | 'clientes' | 'cuentas' | 'mayoristas' | 'telegram';

export interface Tutorial {
  id: string;
  titulo: string;
  descripcion: string;
  categoria: CategoriaTutorial;
  badge: string;
  duracionEstimada: string;
  youtubeId: string;
  urlDestino: string;
  botonTexto: string;
  pasosClave: string[];
  icono: string;
}

export const TUTORIALES: Tutorial[] = [
  {
    id: 'registro-ventas',
    titulo: 'Cómo Registrar una Venta en Stream Control | Guía Paso a Paso',
    descripcion: 'Aprende a emitir ventas de cuentas completas, perfiles individuales o combos de múltiples plataformas con cálculo automático de utilidad y asignación de stock.',
    categoria: 'ventas',
    badge: 'Ventas & Facturación',
    duracionEstimada: '1:48 min',
    youtubeId: 'sPGEYdi85uA',
    urlDestino: '/ventas',
    botonTexto: 'Ir a Registrar Venta',
    pasosClave: [
      'Seleccioná si es venta simple de un perfil o modo combinado multi-servicio.',
      'Ingresá el nombre del cliente, número de WhatsApp y la plataforma.',
      'Elegí una cuenta maestra del inventario con perfiles disponibles o asigná una nueva.',
      'Fijá el precio de venta y revisá el cálculo automático de costo y margen de ganancia.',
      'Confirmá la venta para descontar stock en tiempo real y generar el ticket digital para WhatsApp.',
    ],
    icono: 'DollarSign',
  },
  {
    id: 'gestion-clientes',
    titulo: 'Módulo de Clientes en Stream Control | Guía Paso a Paso',
    descripcion: 'Dominá el ciclo de vida de tus clientes: filtrado de vencimientos próximos, registro de pagos inmediatos y envío de mensajes de renovación por WhatsApp.',
    categoria: 'clientes',
    badge: 'CRM & Clientes',
    duracionEstimada: '1:08 min',
    youtubeId: '5O_iYCg_Ixo',
    urlDestino: '/gestion-clientes',
    botonTexto: 'Ir a Gestión de Clientes',
    pasosClave: [
      'Visualizá el listado de clientes con filtros de Activos, Por Vencer (≤3d) o En Mora.',
      'Tocá el botón de WhatsApp para abrir el chat con el mensaje de cobranza pre-armado.',
      'Registrá cobros o renovaciones con extensión automática de días de servicio.',
      'Consultá el historial de compras y generá links públicos de entrega de accesos.',
      'Liberá o desasigná perfiles inactivos para devolverlos al stock de cuentas disponibles.',
    ],
    icono: 'Users',
  },
  {
    id: 'cuentas-imap',
    titulo: 'Cómo Gestionar Cuentas y Configurar IMAP en Stream Control (Rápido y Fácil)',
    descripcion: 'Organizá tu inventario de cuentas maestras (Netflix, Disney+, etc.) y configurá credenciales IMAP para que tus clientes consulten códigos de acceso de forma 100% automática.',
    categoria: 'cuentas',
    badge: 'Automatización IMAP',
    duracionEstimada: '3:44 min',
    youtubeId: 'Y3WyTz6GTBw',
    urlDestino: '/cuentas',
    botonTexto: 'Ir a Cuentas Streaming',
    pasosClave: [
      'Registrá tu cuenta maestra indicando proveedor, correo, contraseña y perfiles.',
      'Abrí la opción "Configurar IMAP" para conectar el servidor de correo seguro.',
      'Generá y pegá la Contraseña de Aplicación de 16 caracteres de Gmail o Outlook.',
      'Verificá la conexión exitosa en el puerto seguro 993 SSL.',
      'Tus clientes podrán extraer códigos de acceso y hogar automáticamente desde el link de consulta.',
    ],
    icono: 'CreditCard',
  },
  {
    id: 'ventas-mayoristas',
    titulo: 'Registro de Ventas al por Mayor en Stream Control | Guía Paso a Paso',
    descripcion: 'Escalá tu negocio vendiendo por lotes a revendedores. Generá links de consulta con tokens protegidos para que tus mayoristas atiendan a su propia cartera.',
    categoria: 'mayoristas',
    badge: 'Red de Revendedores',
    duracionEstimada: 'Próximamente',
    youtubeId: '',
    urlDestino: '/mayoristas',
    botonTexto: 'Ir a Ventas Mayoristas',
    pasosClave: [
      'Seleccioná la plataforma y la cuenta con stock de perfiles disponibles.',
      'Marcá la cantidad de pantallas a entregar y los días de vigencia acordados.',
      'Ingresá los datos del sub-distribuidor y el precio total mayorista.',
      'Generá el Token Seguro de consulta y compartí el enlace protegido con tu revendedor.',
      'Gestioná el lote desde el CRM de Clientes (identificado con corona 👑) para renovar o revocar.',
    ],
    icono: 'UserPlus',
  },
  {
    id: 'configuracion-telegram',
    titulo: 'Stream Control: Configuración del Bot de Telegram Sin Errores',
    descripcion: 'Vinculá tu cuenta con el bot oficial de StreamControl en Telegram para recibir alertas en tiempo real de clientes por vencer y reportes matutinos.',
    categoria: 'telegram',
    badge: 'Alertas Automáticas',
    duracionEstimada: '0:47 min',
    youtubeId: 'HbiHbCqi4qU',
    urlDestino: '/telegram',
    botonTexto: 'Ir a Configurar Telegram',
    pasosClave: [
      'Entrá a Ajustes → Telegram y hacé clic en "Generar Código de Vinculación".',
      'Abrí el bot oficial de StreamControl en tu aplicación de Telegram.',
      'Enviá /start y pegá tu código de 8 caracteres directamente en el chat.',
      'Recibí la confirmación instantánea de vinculación de tu cuenta.',
      'Recibirás avisos automáticos de vencimientos y mora con acceso directo a cobrar por WhatsApp.',
    ],
    icono: 'Send',
  },
];

export function getTutorialById(id: string): Tutorial | undefined {
  return TUTORIALES.find((t) => t.id === id);
}

export function getTutorialesPorCategoria(categoria: CategoriaTutorial): Tutorial[] {
  return TUTORIALES.filter((t) => t.categoria === categoria);
}
