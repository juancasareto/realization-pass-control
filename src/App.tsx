import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './lib/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AdminLayout } from './components/AdminLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardHoyPage } from './pages/DashboardHoyPage';
import { ClientesPage } from './pages/ClientesPage';
import { ModalidadesPage } from './pages/ModalidadesPage';
import { HorariosPage } from './pages/HorariosPage';
import { CalendarioPage } from './pages/CalendarioPage';
import { VentaPasePage } from './pages/VentaPasePage';
import { FichaClientePage } from './pages/FichaClientePage';
import { ReservasPage } from './pages/ReservasPage';
import { CobrosPage } from './pages/CobrosPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/admin" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
            <Route index element={<DashboardHoyPage />} />
            <Route path="clientes" element={<ClientesPage />} />
            <Route path="clientes/:id" element={<FichaClientePage />} />
            <Route path="clientes/:clienteId/vender" element={<VentaPasePage />} />
            <Route path="reservas" element={<ReservasPage />} />
            <Route path="modalidades" element={<ModalidadesPage />} />
            <Route path="horarios" element={<HorariosPage />} />
            <Route path="calendario" element={<CalendarioPage />} />
            <Route path="cobros" element={<CobrosPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
