import { useState, type FormEvent } from "react";
import { KeyRound, ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../api/apiClient";
import { Button, Card, Field, SectionHeading } from "../components/ui";

/** Kept in step with PASSWORD_MIN_LENGTH in server/src/utils/validation.ts. */
const PASSWORD_MIN_LENGTH = 12;

/**
 * Account settings.
 *
 * Doubles as the forced-reset screen: when `mustChangePassword` is set, App.tsx
 * routes here and nothing else renders, so this has to stand on its own without
 * the surrounding nav. `forced` only changes the copy — the form is identical,
 * which keeps one code path for both entries.
 */
export function Settings({ forced = false }: { forced?: boolean }) {
  const { user, changePassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);

    // Checked here as well as on the server: a mismatch is a typo, and making the
    // user wait for a round trip to hear about it is just rude.
    if (newPassword !== confirmPassword) {
      setError("The two new passwords don't match.");
      return;
    }
    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      setError(`Use at least ${PASSWORD_MIN_LENGTH} characters.`);
      return;
    }

    setIsPending(true);
    try {
      await changePassword(currentPassword, newPassword);
      setSaved(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't change the password.");
    } finally {
      setIsPending(false);
    }
  };

  const form = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Current password" htmlFor="currentPassword">
        <input
          id="currentPassword"
          type="password"
          autoComplete="current-password"
          className="input"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
        />
      </Field>

      <Field
        label="New password"
        htmlFor="newPassword"
        hint={`At least ${PASSWORD_MIN_LENGTH} characters. Length matters more than symbols — a passphrase is fine.`}
      >
        <input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          className="input"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
        />
      </Field>

      <Field label="Confirm new password" htmlFor="confirmPassword">
        <input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          className="input"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
      </Field>

      {error && (
        <p className="rounded-control bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      {saved && (
        <p
          className="flex items-center gap-2 rounded-control bg-success/10 px-3 py-2 text-sm text-success"
          role="status"
        >
          <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />
          Password changed. Any other signed-in device has been signed out.
        </p>
      )}

      <Button type="submit" loading={isPending} disabled={isPending} className="w-full sm:w-auto">
        <KeyRound className="h-4 w-4" aria-hidden />
        Change password
      </Button>
    </form>
  );

  if (forced) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-window px-4">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-sheet bg-accent text-base font-bold text-accent-ink">
              Mi
            </span>
            <h1 className="mt-3 text-lg font-semibold text-ink">Choose a password</h1>
            <p className="text-sm text-ink/70">
              {user?.name ? `${user.name}, this ` : "This "}
              account is still on its generated first password. Set your own to continue.
            </p>
          </div>
          <div className="animate-sheet-in rounded-sheet border border-separator/70 bg-content p-6 shadow-sheet">
            {form}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink">Settings</h1>
        <p className="text-sm text-ink/70">
          Signed in as {user?.email} ({user?.role.toLowerCase()}).
        </p>
      </div>

      <Card className="max-w-lg p-5">
        <SectionHeading
          title="Password"
          description="Changing it signs out every other device."
        />
        {form}
      </Card>
    </div>
  );
}
