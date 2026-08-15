import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getApplication, listApplicationUsers, ApiError } from "../api";
import type { ApplicationDetail, UserListResponse } from "../types";
import { UserTable } from "../components/UserTable";

export function ApplicationUsers() {
  const { id } = useParams<{ id: string }>();
  const [application, setApplication] = useState<ApplicationDetail | null>(null);
  const [userList, setUserList] = useState<UserListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setApplication(null);
    setUserList(null);
    setError(null);
    const appId = Number(id);

    Promise.all([getApplication(appId), listApplicationUsers(appId)])
      .then(([app, users]) => {
        setApplication(app);
        setUserList(users);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load users."));
  }, [id]);

  if (error) return <p className="page-status page-status-error">{error}</p>;
  if (!application || !userList) return <p className="page-status">Loading…</p>;

  return (
    <div>
      <div className="page-heading">
        <h1>{application.name}</h1>
        <Link to={`/settings/${application.id}/edit`}>Edit</Link>
      </div>
      <UserTable appId={application.id} fields={userList.fields} rows={userList.rows} />
    </div>
  );
}
