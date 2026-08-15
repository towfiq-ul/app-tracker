import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./AuthContext";

export function RequireSuperAdmin() {
  const { admin } = useAuth();

  // RequireAuth (the parent route) already handles the loading/unauthenticated cases —
  // by the time this renders, admin is guaranteed non-null.
  if (admin?.role !== "super_admin") return <Navigate to="/dashboard" replace />;

  return <Outlet />;
}
