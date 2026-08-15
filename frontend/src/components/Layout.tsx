import { useEffect } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useToasts, ToastStack } from "./Toast";
import { Logo } from "./Logo";
import { UserMenu } from "./UserMenu";

export function Layout() {
  const { admin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { pathname } = location;
  const { toasts, pushToast } = useToasts();

  // A page that navigates away right after a successful save (e.g. ApplicationFormPage)
  // can't show its own toast — it unmounts too fast — so it hands the message off via
  // router state instead. Replace the state right after reading it so a refresh or
  // back/forward navigation doesn't re-show the same toast.
  useEffect(() => {
    const toastMessage = (location.state as { toast?: string } | null)?.toast;
    if (!toastMessage) return;
    pushToast(toastMessage, "success");
    navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  // A specific application's user-list table wants the full viewport width to fit its
  // (up to 12) columns without truncating data — every other page stays at the normal
  // centered reading width.
  const isUserTablePage = /^\/applications\/\d+/.test(pathname);

  const navItems = [
    { to: "/applications", label: "Applications" },
    { to: "/settings", label: "Settings" },
    ...(admin?.role === "super_admin" ? [{ to: "/users", label: "Users" }] : []),
  ];

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/dashboard" className="app-title">
          <Logo size={22} />
          Application Tracker
        </Link>
        <nav className="nav-pills">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-pill ${isActive ? "nav-pill-active" : ""}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="app-header-right">
          <UserMenu />
        </div>
      </header>
      <main className={`app-main ${isUserTablePage ? "app-main-wide" : ""}`}>
        <Outlet />
      </main>
      <ToastStack toasts={toasts} />
    </div>
  );
}
