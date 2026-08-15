import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./AuthContext";

export function RequireAuth() {
  const { admin, loading } = useAuth();

  if (loading) return <p className="page-status">Checking session…</p>;
  if (!admin) return <Navigate to="/login" replace />;

  return <Outlet />;
}
