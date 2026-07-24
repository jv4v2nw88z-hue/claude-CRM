import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button, Field } from "../components/ui";

export function Login() {
  const { user, isLoading, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (isLoading) return null;
  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-700 text-base font-bold text-white">
            Mi
          </span>
          <h1 className="mt-3 text-lg font-semibold text-slate-900">MiDigitalExpansion CRM</h1>
          <p className="text-sm text-slate-500">Sign in to keep the ladder moving.</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4 p-6">
          <Field label="Email" htmlFor="email">
            <input
              id="email"
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
              autoFocus
            />
          </Field>

          <Field label="Password" htmlFor="password">
            <input
              id="password"
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </Field>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" loading={submitting}>
            Log In
          </Button>
        </form>

        {/* No self-service signup: accounts are created by the seed script. */}
        <p className="mt-4 text-center text-xs text-slate-400">
          Accounts are provisioned internally. Ask Brian if you need access.
        </p>
      </div>
    </div>
  );
}
