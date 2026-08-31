import React from 'react';
import AuthLayout from '../components/Auth/AuthLayout';
import Register from '../components/Auth/Register';

export default function RegisterPage() {
  return (
    <AuthLayout
      subtitle="Comenzá a potenciar tu negocio de servicios digitales y streaming"
      badge="Registro"
    >
      <Register />
    </AuthLayout>
  );
}
