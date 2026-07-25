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
    <div className="flex min-h-screen items-center justify-center bg-window px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-sheet bg-accent text-base font-bold text-accent-ink">
            Mi
          </span>
          <h1 className="mt-3 text-lg font-semibold text-ink">MiDigitalExpansion CRM</h1>
          <p className="text-sm text-ink/70">Sign in to keep the ladder moving.</p>
        </div>

        {/* A macOS sheet rather than a card: larger radius, a real drop shadow,
            and it drops in from above instead of fading in place. */}
        <form
          onSubmit={handleSubmit}
          className="animate-sheet-in space-y-4 rounded-sheet border border-separator/70 bg-content p-6 shadow-sheet"
        >
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
            <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" loading={submitting}>
            Log In
          </Button>
        </form>

        {/* No self-service signup: accounts are created by the seed script. */}
        <p className="mt-4 text-center text-xs text-ink/65">
          Accounts are provisioned internally. Ask Brian if you need access.
        </p>
      </div>
    </div>
  );
}
