import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listApplications, ApiError } from "../api";
import type { ApplicationSummary } from "../types";

export function Applications() {
  const [applications, setApplications] = useState<ApplicationSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listApplications()
      .then(setApplications)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load applications."));
  }, []);

  if (error) return <p className="page-status page-status-error">{error}</p>;
  if (!applications) return <p className="page-status">Loading applications…</p>;

  if (applications.length === 0) {
    return (
      <div className="empty-state">
        <p>No applications yet.</p>
        <Link to="/settings/new">Add your first application</Link>
      </div>
    );
  }

  return (
    <div>
      <h1>Applications</h1>
      <div className="card-grid">
        {applications.map((app) => (
          <Link key={app.id} to={`/applications/${app.id}`} className="app-card">
            <h2>{app.name}</h2>
            <span className="app-card-meta">Added {new Date(app.created_at).toLocaleDateString()}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
