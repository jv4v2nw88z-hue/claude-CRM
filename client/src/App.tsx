import { Component, type ErrorInfo, type ReactNode } from "react";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { Layout } from "./components/Layout";
import { AutomationSettings } from "./pages/AutomationSettings";
import { ClientDetail } from "./pages/ClientDetail";
import { ClientsList } from "./pages/ClientsList";
import { Dashboard } from "./pages/Dashboard";
import { Deals } from "./pages/Deals";
import { Login } from "./pages/Login";
import { Revenue } from "./pages/Revenue";
import { Tasks } from "./pages/Tasks";
import { Button } from "./components/ui";

function RequireAuth() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-brand-700" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<RequireAuth />}>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="clients" element={<ClientsList />} />
            <Route path="clients/:id" element={<ClientDetail />} />
            <Route path="deals" element={<Deals />} />
            <Route path="tasks" element={<Tasks />} />
            <Route path="revenue" element={<Revenue />} />
            <Route path="settings/automations" element={<AutomationSettings />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}

/** A render crash on one page shouldn't take the whole tool down mid-workday. */
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled UI error:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center px-4">
          <div className="card max-w-md p-6 text-center">
            <h1 className="text-base font-semibold text-slate-900">Something broke</h1>
            <p className="mt-1 text-sm text-slate-600">{this.state.error.message}</p>
            <Button className="mt-4" onClick={() => window.location.reload()}>
              Reload the app
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
