import { useState, type FormEvent } from "react";

interface Props {
  open: boolean;
  username: string;
  busy?: boolean;
  onConfirm: (newPassword: string) => void;
  onCancel: () => void;
}

export function ResetPasswordDialog({ open, username, busy = false, onConfirm, onCancel }: Props) {
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setError(null);
    onConfirm(newPassword);
  }

  return (
    <div className="dialog-backdrop" onClick={onCancel}>
      <form
        className="dialog-card"
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
      >
        <h2>Reset password</h2>
        <p>Set a new password for “{username}”. They won't need their old one.</p>
        <label>
          New password
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            autoFocus
            required
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <div className="dialog-actions">
          <button type="button" className="dialog-cancel" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="submit" disabled={busy}>
            {busy ? "Saving…" : "Reset password"}
          </button>
        </div>
      </form>
    </div>
  );
}
