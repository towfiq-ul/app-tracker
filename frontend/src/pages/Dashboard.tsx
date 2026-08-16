import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listApplications, listAdmins } from "../api";
import { useAuth } from "../auth/AuthContext";

export function Dashboard() {
  const { admin } = useAuth();
  const [appCount, setAppCount] = useState<number | null>(null);
  const [userCount, setUserCount] = useState<number | null>(null);

  const isSuperAdmin = admin?.role === "super_admin";

  useEffect(() => {
    listApplications()
      .then((apps) => setAppCount(apps.length))
      .catch(() => setAppCount(null));
  }, []);

  useEffect(() => {
    if (!isSuperAdmin) return;
    listAdmins()
      .then((admins) => setUserCount(admins.length))
      .catch(() => setUserCount(null));
  }, [isSuperAdmin]);

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
      {isSuperAdmin && (
        <Link to="/users" className="app-card">
          <h2>Users</h2>
          <span className="app-card-meta">
            {userCount === null ? "Manage portal admins and their access" : `${userCount} portal user${userCount === 1 ? "" : "s"}`}
          </span>
        </Link>
      )}
    </div>
  );
}
