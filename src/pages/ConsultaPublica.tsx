import React from 'react';
import { useParams } from 'react-router-dom';

export default function ConsultaPublica() {
  const { token } = useParams<{ token: string }>();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-indigo-950 to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white/5 backdrop-blur-xl rounded-2xl p-8 border border-white/10">
        <h1 className="text-2xl font-bold text-white">Consulta de Códigos</h1>
        <p className="text-gray-400 mt-2">Validando token...</p>
        <p className="text-gray-500 text-sm mt-4">Token: {token}</p>
      </div>
    </div>
  );
}
