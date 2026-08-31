import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { ToastProvider } from './components/ToastProvider';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Appointments from './pages/Appointments';
import Customers from './pages/Customers';
import Services from './pages/Services';
import Staff from './pages/Staff';
import Statistics from './pages/Statistics';
import Promotions from './pages/Promotions';
import Settings from './pages/Settings';

function Gate({ children }) {
  const { isAuthenticated, isVerifying } = useAuth();

  if (isVerifying) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <span className="w-7 h-7 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!isAuthenticated) return <Login />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route
              element={
                <Gate>
                  <Layout />
                </Gate>
              }
            >
              <Route path="/" element={<Dashboard />} />
              <Route path="/appointments" element={<Appointments />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/services" element={<Services />} />
              <Route path="/staff" element={<Staff />} />
              <Route path="/statistics" element={<Statistics />} />
              <Route path="/promotions" element={<Promotions />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
