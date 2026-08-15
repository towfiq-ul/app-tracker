import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listApplications, deleteApplication, ApiError } from "../api";
import type { ApplicationSummary } from "../types";
import { ConfirmDialog } from "../components/ConfirmDialog";

export function Settings() {
  const [applications, setApplications] = useState<ApplicationSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ApplicationSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function reload() {
    listApplications()
      .then(setApplications)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load applications."));
  }

  useEffect(reload, []);

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteApplication(pendingDelete.id);
      setPendingDelete(null);
      reload();
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : "Failed to delete application.");
    } finally {
      setDeleting(false);
    }
  }

  if (error) return <p className="page-status page-status-error">{error}</p>;
  if (!applications) return <p className="page-status">Loading…</p>;

  return (
    <div>
      <div className="page-heading">
        <h1>Settings</h1>
        <Link to="/settings/new">Add</Link>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Added</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {applications.map((app) => (
              <tr key={app.id}>
                <td>{app.name}</td>
                <td>{new Date(app.created_at).toLocaleDateString()}</td>
                <td className="row-actions">
                  <Link to={`/settings/${app.id}/edit`}>Edit</Link>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteError(null);
                      setPendingDelete(app);
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {deleteError && <p className="form-error">{deleteError}</p>}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete application"
        message={pendingDelete ? `Delete "${pendingDelete.name}"? This can't be undone.` : ""}
        confirmLabel={deleting ? "Deleting…" : "Delete"}
        danger
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
