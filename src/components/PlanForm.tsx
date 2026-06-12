import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Plan, PlanInput } from '../types/plan';

interface PlanFormProps {
  plan?: Plan | null;
  onClose: () => void;
  onSave: (data: PlanInput) => Promise<void>;
}

export default function PlanForm({ plan, onClose, onSave }: PlanFormProps) {
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [precio, setPrecio] = useState('');
  const [duracionDias, setDuracionDias] = useState('');
  const [features, setFeatures] = useState<string[]>([]);
  const [newFeature, setNewFeature] = useState('');
  const [activo, setActivo] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const isEdit = !!plan;

  useEffect(() => {
    if (plan) {
      setNombre(plan.nombre);
      setDescripcion(plan.descripcion);
      setPrecio(String(plan.precio));
      setDuracionDias(String(plan.duracionDias));
      setFeatures([...plan.features]);
      setActivo(plan.activo);
    }
  }, [plan]);

  const addFeature = () => {
    const trimmed = newFeature.trim();
    if (!trimmed) return;
    if (features.length >= 20) {
      toast.error('Máximo 20 características');
      return;
    }
    if (trimmed.length > 200) {
      toast.error('Cada característica debe tener máximo 200 caracteres');
      return;
    }
    setFeatures([...features, trimmed]);
    setNewFeature('');
  };

  const removeFeature = (index: number) => {
    setFeatures(features.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addFeature();
    }
  };

  const validate = (): boolean => {
    if (!nombre.trim()) {
      toast.error('El nombre es obligatorio');
      return false;
    }
    if (nombre.trim().length > 100) {
      toast.error('El nombre debe tener máximo 100 caracteres');
      return false;
    }
    if (!descripcion.trim()) {
      toast.error('La descripción es obligatoria');
      return false;
    }
    if (descripcion.trim().length > 500) {
      toast.error('La descripción debe tener máximo 500 caracteres');
      return false;
    }
    const precioNum = Number(precio);
    if (isNaN(precioNum) || precioNum < 0) {
      toast.error('El precio debe ser mayor o igual a 0');
      return false;
    }
    const duracionNum = Number(duracionDias);
    if (isNaN(duracionNum) || duracionNum < 1 || !Number.isInteger(duracionNum)) {
      toast.error('La duración debe ser un número entero mayor o igual a 1');
      return false;
    }
    if (features.some(f => !f.trim())) {
      toast.error('Las características no pueden estar vacías');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      await onSave({
        nombre: nombre.trim(),
        descripcion: descripcion.trim(),
        precio: Number(precio),
        duracionDias: Number(duracionDias),
        features: features.filter(f => f.trim()),
        activo,
      });
      toast.success(isEdit ? 'Plan actualizado correctamente' : 'Plan creado correctamente');
      onClose();
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error guardando plan:', error);
      toast.error(error.message || 'Error al guardar el plan');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="card max-w-2xl w-full animate-scale-in max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {isEdit ? 'Editar Plan' : 'Crear Plan'}
            </h2>
            <p className="text-gray-600 mt-1">
              {isEdit ? 'Actualiza la información del plan' : 'Define un nuevo plan de suscripción'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={24} className="text-gray-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Premium"
              className="w-full"
              maxLength={100}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Descripción <span className="text-red-500">*</span>
            </label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Describe el plan..."
              className="w-full"
              rows={3}
              maxLength={500}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Precio <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">$</span>
                <input
                  type="number"
                  value={precio}
                  onChange={(e) => setPrecio(e.target.value)}
                  className="w-full pl-7"
                  min="0"
                  step="0.01"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Duración (días) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={duracionDias}
                onChange={(e) => setDuracionDias(e.target.value)}
                className="w-full"
                min="1"
                step="1"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Características
            </label>
            <div className="space-y-2">
              {features.map((feat, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={feat}
                    onChange={(e) => {
                      const updated = [...features];
                      updated[index] = e.target.value;
                      setFeatures(updated);
                    }}
                    className="flex-1"
                    maxLength={200}
                  />
                  <button
                    type="button"
                    onClick={() => removeFeature(index)}
                    className="p-2 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newFeature}
                  onChange={(e) => setNewFeature(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Agregar característica..."
                  className="flex-1"
                  maxLength={200}
                  disabled={features.length >= 20}
                />
                <button
                  type="button"
                  onClick={addFeature}
                  disabled={features.length >= 20}
                  className="p-2 rounded-lg bg-indigo-100 text-indigo-600 hover:bg-indigo-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus size={16} />
                </button>
              </div>
              <p className="text-xs text-gray-400">
                {features.length}/20 características
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between bg-gray-50 rounded-xl px-5 py-4">
            <div>
              <p className="font-medium text-gray-700">Plan activo</p>
              <p className="text-sm text-gray-400">Los planes inactivos no aparecen en los selectores</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={activo}
                onChange={(e) => setActivo(e.target.checked)}
                className="sr-only peer"
                aria-label="Plan activo"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-indigo-500 peer-checked:to-indigo-600"></div>
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancelar
            </button>
            <button type="submit" disabled={submitting} className="btn-primary flex-1">
              {submitting ? 'Guardando...' : isEdit ? 'Guardar Cambios' : 'Crear Plan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
