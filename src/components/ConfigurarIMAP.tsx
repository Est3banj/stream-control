import React, { useState } from 'react';
import { callFunction } from '../lib/apiClient';
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
      await callFunction('guardarCredenciales', {
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
    <form onSubmit={handleSubmit} className="space-y-6 text-slate-100">
      <div className="flex items-center gap-3 p-4 bg-amber-950/30 rounded-xl border border-amber-800/40">
        <Shield size={20} className="text-amber-400 shrink-0" />
        <p className="text-sm text-amber-300">
          Las credenciales se guardan de forma segura y solo son accesibles
          por el sistema para la consulta automática de códigos de verificación.
        </p>
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-300 mb-2">
          Correo de la cuenta <span className="text-rose-400">*</span>
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input
            type="email"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            className="w-full pl-10 bg-slate-900/80 border border-slate-700/80 text-slate-100 placeholder-slate-500 font-mono"
            placeholder="netflix@ejemplo.com"
            required
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-300 mb-2">
          Contraseña <span className="text-rose-400">*</span>
        </label>
        <div className="relative">
          <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input
            type="password"
            value={contrasena}
            onChange={(e) => setContrasena(e.target.value)}
            className="w-full pl-10 bg-slate-900/80 border border-slate-700/80 text-slate-100 placeholder-slate-500 font-mono"
            placeholder="Contraseña de la cuenta"
            required
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-300 mb-2">
          Proveedor de correo
        </label>
        <select
          value={proveedorIMAP}
          onChange={(e) => handleProveedorChange(e.target.value)}
          className="w-full bg-slate-900/80 border border-slate-700/80 text-slate-100"
        >
          {PROVEEDORES_IMAP.map(p => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-2">
            Host IMAP <span className="text-rose-400">*</span>
          </label>
          <div className="relative">
            <Server className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input
              type="text"
              value={imapHost}
              onChange={(e) => setImapHost(e.target.value)}
              className="w-full pl-10 bg-slate-900/80 border border-slate-700/80 text-slate-100 placeholder-slate-500 font-mono"
              placeholder="imap.gmail.com"
              required
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-2">
            Puerto
          </label>
          <input
            type="number"
            value={imapPort}
            onChange={(e) => setImapPort(e.target.value)}
            className="w-full bg-slate-900/80 border border-slate-700/80 text-slate-100"
            min="1"
            max="65535"
            placeholder="993"
          />
        </div>
      </div>

      <div className="flex gap-3 pt-4 border-t border-slate-800">
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
