import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { listAdmins, createAdmin, updateAdmin, ApiError, type AdminCreateInput, type AdminUpdateInput } from "../api";
import type { Admin } from "../types";
import { useAuth } from "../auth/AuthContext";
import { AdminForm } from "../components/AdminForm";

export function UserFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { admin: currentAdmin } = useAuth();
  const mode = id ? "edit" : "create";

  const [target, setTarget] = useState<Admin | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(mode === "edit");

  useEffect(() => {
    if (mode !== "edit" || !id) return;
    // There's no GET /api/admins/:id — the list is small (this is an internal admin tool),
    // so reusing the already-fetched list avoids a route that would only ever have one caller.
    listAdmins()
      .then((admins) => {
        const found = admins.find((a) => a.id === Number(id));
        if (!found) throw new ApiError("User not found.", 404);
        setTarget(found);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load user."))
      .finally(() => setLoading(false));
  }, [mode, id]);

  async function handleSubmit(input: AdminCreateInput | AdminUpdateInput) {
    if (mode === "create") {
      await createAdmin(input as AdminCreateInput);
      navigate("/users", { state: { toast: `"${input.username}" added.` } });
    } else {
      await updateAdmin(Number(id), input as AdminUpdateInput);
      navigate("/users", { state: { toast: `"${input.username}" saved.` } });
    }
  }

  if (loading) return <p className="page-status">Loading…</p>;
  if (error) return <p className="page-status page-status-error">{error}</p>;

  return (
    <div>
      <h1>{mode === "create" ? "Add user" : `Edit ${target?.username}`}</h1>
      <AdminForm
        mode={mode}
        initial={target ?? undefined}
        isSelf={mode === "edit" && target?.id === currentAdmin?.id}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
