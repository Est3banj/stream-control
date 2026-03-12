import React from 'react';
import VentasForm from '../components/VentasForm';

export default function Ventas() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-4xl sm:text-5xl font-extrabold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 via-purple-600 to-cyan-600">
          Registrar Venta
        </h1>
        <p className="text-gray-600">Completa el formulario para registrar una nueva venta</p>
      </div>
      <VentasForm />
    </div>
  );
}
