import type { ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ConfigPage } from "./pages/Config";
import { DashboardPage } from "./pages/Dashboard";
import { FinesPage } from "./pages/Fines";
import { LoginPage } from "./pages/Login";
import { ReservationsPage } from "./pages/Reservations";
import { UsersPage } from "./pages/Users";

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="login-page">
        <p>Loading...</p>
      </div>
    );
  }

  if (!user || !profile) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="config" element={<ConfigPage />} />
            <Route path="reservations" element={<ReservationsPage />} />
            <Route path="fines" element={<FinesPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
