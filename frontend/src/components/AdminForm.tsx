import { useState, type FormEvent } from "react";
import type { Admin, AdminRole } from "../types";
import type { AdminCreateInput, AdminUpdateInput } from "../api";

interface Props {
  mode: "create" | "edit";
  initial?: Admin;
  // The signed-in super_admin editing their own row can't demote themselves — the role
  // selector is disabled in that one case so they can't lock themselves out.
  isSelf?: boolean;
  onSubmit: (input: AdminCreateInput | AdminUpdateInput) => Promise<void>;
}

export function AdminForm({ mode, initial, isSelf, onSubmit }: Props) {
  const [username, setUsername] = useState(initial?.username ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AdminRole>(initial?.role ?? "admin");
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [contactNo, setContactNo] = useState(initial?.contact_no ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (mode === "create" && password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "create") {
        await onSubmit({
          username: username.trim(),
          password,
          role,
          name: name.trim(),
          email: email.trim(),
          contact_no: contactNo.trim(),
        });
      } else {
        await onSubmit({
          username: username.trim(),
          role,
          name: name.trim(),
          email: email.trim(),
          contact_no: contactNo.trim(),
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="application-form" onSubmit={handleSubmit}>
      <label>
        Username
        <input value={username} onChange={(e) => setUsername(e.target.value)} required />
      </label>

      {mode === "create" && (
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>
      )}

      <div className="form-row">
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          Role
          <select value={role} onChange={(e) => setRole(e.target.value as AdminRole)} disabled={isSelf}>
            <option value="admin">Admin</option>
            <option value="super_admin">Super admin</option>
          </select>
        </label>
      </div>

      <div className="form-row">
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Contact number
          <input value={contactNo} onChange={(e) => setContactNo(e.target.value)} />
        </label>
      </div>

      {error && <p className="form-error">{error}</p>}
      <button type="submit" disabled={submitting}>
        {submitting ? "Saving…" : mode === "create" ? "Add user" : "Save changes"}
      </button>
    </form>
  );
}
