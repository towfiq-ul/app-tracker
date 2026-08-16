import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function UserMenu() {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  if (!admin) return null;

  const displayName = admin.name || admin.email || admin.username;

  return (
    <div className="user-menu" ref={rootRef}>
      <button
        type="button"
        className="user-menu-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="user-menu-avatar" aria-hidden="true">
          {displayName.slice(0, 1)}
        </span>
        <span className="app-user">{displayName}</span>
        <span className={`user-menu-caret ${open ? "user-menu-caret-open" : ""}`} aria-hidden="true">
          ▾
        </span>
      </button>
      {open && (
        <div className="user-menu-panel" role="menu">
          <Link to="/profile" role="menuitem" className="user-menu-item" onClick={() => setOpen(false)}>
            Profile
          </Link>
          <button type="button" role="menuitem" className="user-menu-item user-menu-item-danger" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
