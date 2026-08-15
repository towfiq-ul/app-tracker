import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getApplication, createApplication, updateApplication, ApiError, type ApplicationFormInput } from "../api";
import type { ApplicationDetail } from "../types";
import { ApplicationForm } from "../components/ApplicationForm";

export function ApplicationFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const mode = id ? "edit" : "create";

  const [application, setApplication] = useState<ApplicationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(mode === "edit");

  useEffect(() => {
    if (mode !== "edit" || !id) return;
    getApplication(Number(id))
      .then(setApplication)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load application."))
      .finally(() => setLoading(false));
  }, [mode, id]);

  async function handleSubmit(input: ApplicationFormInput) {
    if (mode === "create") {
      const { id: newId } = await createApplication(input);
      navigate(`/applications/${newId}`, { state: { toast: `"${input.name}" created.` } });
    } else {
      await updateApplication(Number(id), input);
      navigate(`/applications/${id}`, { state: { toast: `"${input.name}" saved.` } });
    }
  }

  if (loading) return <p className="page-status">Loading…</p>;
  if (error) return <p className="page-status page-status-error">{error}</p>;

  return (
    <div>
      <h1>{mode === "create" ? "Add application" : `Edit ${application?.name}`}</h1>
      <ApplicationForm mode={mode} initial={application ?? undefined} onSubmit={handleSubmit} />
    </div>
  );
}
