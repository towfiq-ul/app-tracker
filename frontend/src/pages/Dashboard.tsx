import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listApplications } from "../api";

export function Dashboard() {
  const [appCount, setAppCount] = useState<number | null>(null);

  useEffect(() => {
    listApplications()
      .then((apps) => setAppCount(apps.length))
      .catch(() => setAppCount(null));
  }, []);

  return (
    <div className="card-grid">
      <Link to="/applications" className="app-card">
        <h2>Applications</h2>
        <span className="app-card-meta">
          {appCount === null ? "Browse applications and view their user lists" : `${appCount} configured application${appCount === 1 ? "" : "s"}`}
        </span>
      </Link>
      <Link to="/settings" className="app-card">
        <h2>Settings</h2>
        <span className="app-card-meta">Add, edit, or remove applications</span>
      </Link>
    </div>
  );
}
