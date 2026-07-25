import { Component, Suspense, lazy, type ErrorInfo, type ReactNode } from "react";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { Settings } from "./pages/Settings";
import { Button } from "./components/ui";

/**
 * Pages load on demand.
 *
 * Eagerly importing all eight put the whole app — including recharts and
 * @dnd-kit, which only two pages use — into one ~740 KB bundle that every
 * visitor downloaded before seeing the login form. That is the wrong trade on a
 * phone on cell data, which is where half this app's use happens. Login stays
 * eager because it is always the first paint for a signed-out user.
 */
const Dashboard = lazy(() => import("./pages/Dashboard").then((m) => ({ default: m.Dashboard })));
const ClientsList = lazy(() =>
  import("./pages/ClientsList").then((m) => ({ default: m.ClientsList }))
);
const ClientDetail = lazy(() =>
  import("./pages/ClientDetail").then((m) => ({ default: m.ClientDetail }))
);
const Deals = lazy(() => import("./pages/Deals").then((m) => ({ default: m.Deals })));
const Tasks = lazy(() => import("./pages/Tasks").then((m) => ({ default: m.Tasks })));
const Revenue = lazy(() => import("./pages/Revenue").then((m) => ({ default: m.Revenue })));
const AutomationSettings = lazy(() =>
  import("./pages/AutomationSettings").then((m) => ({ default: m.AutomationSettings }))
);

/** Matches the auth spinner, so a chunk fetch looks like any other short wait. */
function RouteFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-separator/70 border-t-accent" />
    </div>
  );
}

function RequireAuth() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-separator/70 border-t-accent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  /*
   * The reset gate. Rendered here rather than as a route so it cannot be
   * navigated around: every authenticated path in the app is behind this
   * component, so an account still on its generated password reaches nothing
   * else — not by typing a URL, not via a stale bookmark.
   */
  if (user.mustChangePassword) return <Settings forced />;

  return <Outlet />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<RequireAuth />}>
          <Route element={<Layout />}>
            {/* Inside Layout, so the nav stays put while a page chunk loads. */}
            <Route
              element={
                <Suspense fallback={<RouteFallback />}>
                  <Outlet />
                </Suspense>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="clients" element={<ClientsList />} />
              <Route path="clients/:id" element={<ClientDetail />} />
              <Route path="deals" element={<Deals />} />
              <Route path="tasks" element={<Tasks />} />
              <Route path="revenue" element={<Revenue />} />
              <Route path="settings" element={<Settings />} />
              <Route path="settings/automations" element={<AutomationSettings />} />
            </Route>
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
            <h1 className="text-base font-semibold text-ink">Something broke</h1>
            <p className="mt-1 text-sm text-ink/70">{this.state.error.message}</p>
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
