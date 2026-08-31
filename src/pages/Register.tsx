import React from 'react';
import { useNavigate } from 'react-router-dom';
import AuthLayout from '../components/Auth/AuthLayout';
import Register from '../components/Auth/Register';

export default function RegisterPage() {
  const nav = useNavigate();

  return (
    <AuthLayout
      subtitle="Comenzá a potenciar tu negocio de servicios digitales y streaming"
      badge="Registro"
    >
      <Register onSwitchToLogin={() => nav('/login')} />
    </AuthLayout>
  );
}
