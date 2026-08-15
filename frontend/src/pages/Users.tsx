import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listAdmins, deleteAdmin, resetAdminPassword, ApiError } from "../api";
import type { Admin } from "../types";
import { useAuth } from "../auth/AuthContext";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ResetPasswordDialog } from "../components/ResetPasswordDialog";
import { useToasts, ToastStack } from "../components/Toast";

export function Users() {
  const { admin: currentAdmin } = useAuth();
  const { toasts, pushToast } = useToasts();

  const [admins, setAdmins] = useState<Admin[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Admin | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [pendingReset, setPendingReset] = useState<Admin | null>(null);
  const [resetting, setResetting] = useState(false);

  function reload() {
    listAdmins()
      .then(setAdmins)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load users."));
  }

  useEffect(reload, []);

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteAdmin(pendingDelete.id);
      setPendingDelete(null);
      pushToast(`"${pendingDelete.username}" removed.`, "success");
      reload();
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : "Failed to remove user.", "error");
    } finally {
      setDeleting(false);
    }
  }

  async function confirmReset(newPassword: string) {
    if (!pendingReset) return;
    setResetting(true);
    try {
      await resetAdminPassword(pendingReset.id, newPassword);
      pushToast(`Password reset for "${pendingReset.username}".`, "success");
      setPendingReset(null);
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : "Failed to reset password.", "error");
    } finally {
      setResetting(false);
    }
  }

  if (error) return <p className="page-status page-status-error">{error}</p>;
  if (!admins) return <p className="page-status">Loading…</p>;

  return (
    <div>
      <div className="page-heading">
        <h1>Users</h1>
        <Link to="/users/new">Add</Link>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Username</th>
              <th>Name</th>
              <th>Role</th>
              <th>Email</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {admins.map((admin) => (
              <tr key={admin.id}>
                <td>{admin.username}</td>
                <td>{admin.name}</td>
                <td>
                  <span className={`pill ${admin.role === "super_admin" ? "pill-good" : "pill-bad"}`}>
                    {admin.role === "super_admin" ? "Super admin" : "Admin"}
                  </span>
                </td>
                <td>{admin.email || <span className="cell-empty">—</span>}</td>
                <td className="row-actions">
                  <Link to={`/users/${admin.id}/edit`}>Edit</Link>
                  <button type="button" onClick={() => setPendingReset(admin)}>
                    Reset password
                  </button>
                  {admin.id !== currentAdmin?.id && (
                    <button type="button" onClick={() => setPendingDelete(admin)}>
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Remove user"
        message={pendingDelete ? `Remove "${pendingDelete.username}"? They'll lose access immediately.` : ""}
        confirmLabel={deleting ? "Removing…" : "Remove"}
        danger
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />

      <ResetPasswordDialog
        open={pendingReset !== null}
        username={pendingReset?.username ?? ""}
        busy={resetting}
        onConfirm={confirmReset}
        onCancel={() => setPendingReset(null)}
      />

      <ToastStack toasts={toasts} />
    </div>
  );
}
