import React, { useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Key, Mail, Server, Shield } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Cuenta } from '../types/cuenta';

interface ConfigurarIMAPProps {
  cuenta: Cuenta;
  onClose: () => void;
  onSuccess?: () => void;
}

const PROVEEDORES_IMAP = [
  { value: 'gmail', label: 'Gmail', host: 'imap.gmail.com', port: 993 },
  { value: 'outlook', label: 'Outlook', host: 'outlook.office365.com', port: 993 },
  { value: 'otro', label: 'Otro', host: '', port: 993 },
];

export default function ConfigurarIMAP({ cuenta, onClose, onSuccess }: ConfigurarIMAPProps) {
  const [correo, setCorreo] = useState(cuenta.correoCuenta);
  const [contrasena, setContrasena] = useState('');
  const [proveedorIMAP, setProveedorIMAP] = useState('gmail');
  const [imapHost, setImapHost] = useState('imap.gmail.com');
  const [imapPort, setImapPort] = useState('993');
  const [guardando, setGuardando] = useState(false);

  const handleProveedorChange = (value: string) => {
    setProveedorIMAP(value);
    const prov = PROVEEDORES_IMAP.find(p => p.value === value);
    if (prov && prov.host) {
      setImapHost(prov.host);
      setImapPort(String(prov.port));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!correo.trim()) {
      toast.error('El correo es obligatorio');
      return;
    }
    if (!contrasena.trim()) {
      toast.error('La contraseña es obligatoria');
      return;
    }
    if (!imapHost.trim()) {
      toast.error('El host IMAP es obligatorio');
      return;
    }

    setGuardando(true);
    try {
      const functions = getFunctions();
      const guardar = httpsCallable(functions, 'guardarCredenciales');
      await guardar({
        cuentaId: cuenta.id,
        correo: correo.trim(),
        contrasena: contrasena.trim(),
        imapHost: imapHost.trim(),
        imapPort: Number(imapPort),
        proveedorIMAP,
      });
      toast.success('Credenciales IMAP guardadas correctamente');
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
      console.error('Error guardando credenciales IMAP:', err);
      toast.error(`Error al guardar: ${errorMsg}`);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-xl border border-amber-200">
        <Shield size={20} className="text-amber-600 shrink-0" />
        <p className="text-sm text-amber-800">
          Las credenciales se guardan de forma segura y solo son accesibles
          por el sistema para la consulta automática de códigos de verificación.
        </p>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Correo de la cuenta <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="email"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            className="w-full pl-10"
            placeholder="netflix@ejemplo.com"
            required
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Contraseña <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="password"
            value={contrasena}
            onChange={(e) => setContrasena(e.target.value)}
            className="w-full pl-10"
            placeholder="Contraseña de la cuenta"
            required
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Proveedor de correo
        </label>
        <select
          value={proveedorIMAP}
          onChange={(e) => handleProveedorChange(e.target.value)}
          className="w-full"
        >
          {PROVEEDORES_IMAP.map(p => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Host IMAP <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Server className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              value={imapHost}
              onChange={(e) => setImapHost(e.target.value)}
              className="w-full pl-10"
              placeholder="imap.gmail.com"
              required
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Puerto
          </label>
          <input
            type="number"
            value={imapPort}
            onChange={(e) => setImapPort(e.target.value)}
            className="w-full"
            min="1"
            max="65535"
            placeholder="993"
          />
        </div>
      </div>

      <div className="flex gap-3 pt-4 border-t border-gray-100">
        <button type="button" onClick={onClose} className="btn-secondary flex-1" disabled={guardando}>
          Cancelar
        </button>
        <button type="submit" className="btn-primary flex-1" disabled={guardando}>
          {guardando ? 'Guardando...' : 'Guardar Credenciales'}
        </button>
      </div>
    </form>
  );
}
