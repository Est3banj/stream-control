# Cloud Functions - StreamControl Pro

Este directorio contiene las Cloud Functions de Firebase para StreamControl Pro.

## 📋 Funciones Disponibles

### `generarNotificacionesVencimientos`

Función programada que se ejecuta cada 24 horas y genera notificaciones automáticas cuando los clientes están próximos a vencer su servicio (1, 2 o 3 días).

**Características:**
- Se ejecuta automáticamente cada 24 horas
- Revisa todos los clientes en la colección `clientes`
- Calcula los días restantes hasta la fecha de vencimiento
- Genera notificaciones solo para clientes que vencen en 1, 2 o 3 días
- Evita duplicados: no genera más de una notificación por cliente por día
- Crea documentos en la colección `notificaciones` con la siguiente estructura:

```javascript
{
  clienteId: string,
  nombreCliente: string,
  plataforma: string,
  diasRestantes: number, // 1, 2 o 3
  fechaVencimiento: string,
  propietarioId: string,
  usuarioEmail: string,
  fechaGenerada: Timestamp,
  leida: boolean
}
```

## 🚀 Instalación y Despliegue

### Prerrequisitos

1. Instalar Firebase CLI:
```bash
npm install -g firebase-tools
```

2. Iniciar sesión en Firebase:
```bash
firebase login
```

3. Seleccionar el proyecto:
```bash
firebase use streamcontrol-10837
```

### Instalación de Dependencias

```bash
cd functions
npm install
```

### Despliegue

Para desplegar todas las funciones:

```bash
firebase deploy --only functions
```

Para desplegar solo la función de notificaciones:

```bash
firebase deploy --only functions:generarNotificacionesVencimientos
```

### Configuración de Zona Horaria

La función está configurada para ejecutarse en la zona horaria `America/Bogota`. Para cambiarla, edita `functions/index.js`:

```javascript
.timeZone('America/Bogota') // Cambiar por tu zona horaria
```

Zonas horarias comunes:
- `America/Mexico_City` - México
- `America/Argentina/Buenos_Aires` - Argentina
- `America/Santiago` - Chile
- `America/Lima` - Perú
- `America/Caracas` - Venezuela

## 🧪 Pruebas Locales

Para probar las funciones localmente:

```bash
cd functions
npm run serve
```

Esto iniciará el emulador de Firebase Functions en `http://localhost:5001`.

## 📝 Logs

Para ver los logs de las funciones:

```bash
firebase functions:log
```

Para ver logs en tiempo real:

```bash
firebase functions:log --follow
```

## ⚙️ Configuración

### Cambiar Frecuencia de Ejecución

Para cambiar la frecuencia de ejecución, edita `functions/index.js`:

```javascript
.schedule('every 24 hours') // Cambiar por: 'every 1 hours', 'every 6 hours', etc.
```

### Cambiar Días de Notificación

Para cambiar los días de anticipación (actualmente 1, 2, 3), edita la condición en `functions/index.js`:

```javascript
if (diasRestantes >= 1 && diasRestantes <= 3) {
  // Cambiar el rango según necesites
}
```

## 🔒 Seguridad

Las funciones utilizan Firebase Admin SDK, que tiene acceso completo a Firestore. Las reglas de seguridad de Firestore no se aplican a las Cloud Functions.

**Importante:** Las funciones solo crean notificaciones, no las leen ni actualizan desde el frontend. El frontend solo puede:
- Leer notificaciones (según reglas de Firestore)
- Marcar notificaciones como leídas (actualizar campo `leida`)

## 📊 Monitoreo

Puedes monitorear el rendimiento de las funciones en la consola de Firebase:
1. Ve a Firebase Console
2. Selecciona tu proyecto
3. Ve a Functions
4. Revisa métricas, logs y ejecuciones

## 🐛 Solución de Problemas

### La función no se ejecuta

1. Verifica que la función esté desplegada:
```bash
firebase functions:list
```

2. Revisa los logs:
```bash
firebase functions:log
```

3. Verifica que el proyecto tenga habilitado Cloud Scheduler (requerido para funciones programadas)

### Notificaciones duplicadas

La función evita duplicados usando un ID único basado en:
- `propietarioId`
- `clienteId`
- Fecha actual (formato YYYY-MM-DD)

Si ves duplicados, verifica que el ID de notificación se esté generando correctamente.

## 📚 Recursos

- [Documentación de Firebase Functions](https://firebase.google.com/docs/functions)
- [Cloud Scheduler](https://cloud.google.com/scheduler/docs)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)





