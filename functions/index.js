/**
 * Cloud Functions para StreamControl Pro
 * 
 * Función programada que genera notificaciones automáticas
 * cuando los clientes están próximos a vencer (1, 2 o 3 días)
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Inicializar Firebase Admin si no está inicializado
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Función programada que se ejecuta cada 24 horas
 * Revisa todos los clientes y genera notificaciones para los que vencen en 1, 2 o 3 días
 */
exports.generarNotificacionesVencimientos = functions.pubsub
  .schedule('every 24 hours')
  .timeZone('America/Bogota') // Ajustar según tu zona horaria
  .onRun(async (context) => {
    console.log('🔔 Iniciando generación de notificaciones de vencimientos...');

    try {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);

      // Obtener todos los clientes
      const clientesSnapshot = await db.collection('clientes').get();

      if (clientesSnapshot.empty) {
        console.log('No hay clientes para revisar');
        return null;
      }

      let notificacionesCreadas = 0;
      const batch = db.batch();
      let batchCount = 0;
      const MAX_BATCH_SIZE = 500; // Límite de Firestore

      for (const clienteDoc of clientesSnapshot.docs) {
        const cliente = clienteDoc.data();
        
        if (!cliente.fechaVencimiento) {
          continue;
        }

        const fechaVencimiento = new Date(cliente.fechaVencimiento);
        fechaVencimiento.setHours(0, 0, 0, 0);

        // Calcular días restantes
        const diffTime = fechaVencimiento - hoy;
        const diasRestantes = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // Solo generar notificación si faltan 1, 2 o 3 días
        if (diasRestantes >= 1 && diasRestantes <= 3) {
          // Verificar si ya existe una notificación para este cliente hoy
          const hoyStr = hoy.toISOString().split('T')[0];
          const notificacionId = `${cliente.propietarioId}_${clienteDoc.id}_${hoyStr}`;
          
          const notifRef = db.collection('notificaciones').doc(notificacionId);
          const notifDoc = await notifRef.get();

          // Solo crear si no existe una notificación para hoy
          if (!notifDoc.exists) {
            const notificacion = {
              clienteId: clienteDoc.id,
              nombreCliente: cliente.nombre || '',
              plataforma: cliente.plataforma || '',
              diasRestantes: diasRestantes,
              fechaVencimiento: cliente.fechaVencimiento,
              propietarioId: cliente.propietarioId,
              usuarioEmail: cliente.usuarioEmail || '',
              fechaGenerada: admin.firestore.FieldValue.serverTimestamp(),
              leida: false,
            };

            batch.set(notifRef, notificacion);
            batchCount++;
            notificacionesCreadas++;

            // Si el batch alcanza el límite, ejecutarlo y crear uno nuevo
            if (batchCount >= MAX_BATCH_SIZE) {
              await batch.commit();
              batchCount = 0;
            }
          }
        }
      }

      // Ejecutar el batch final si hay operaciones pendientes
      if (batchCount > 0) {
        await batch.commit();
      }

      console.log(`✅ Notificaciones generadas: ${notificacionesCreadas}`);
      return null;
    } catch (error) {
      console.error('❌ Error generando notificaciones:', error);
      throw error;
    }
  });





