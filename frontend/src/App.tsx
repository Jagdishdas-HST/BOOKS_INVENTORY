import { Routes, Route, Navigate } from "react-router-dom";
import { Suspense, lazy } from "react";
import { ClientOnly } from "@/components/ClientOnly";
import { useAuthStore } from "@/lib/authStore";

const LoginPage = lazy(() => import("@/pages/Login"));
const DashboardPage = lazy(() => import("@/pages/Dashboard"));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <ClientOnly fallback={<div className="min-h-screen bg-slate-50" />}>
      <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Suspense>
    </ClientOnly>
  );
}