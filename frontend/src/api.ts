import type { Admin, ApplicationDetail, ApplicationSummary, FieldSchemaEntry, UserListResponse } from "./types";

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    credentials: "include",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message = (body as { error?: string } | null)?.error || response.statusText || `Request failed (${response.status})`;
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function login(username: string, password: string): Promise<Admin> {
  return request<Admin>("/api/login", { method: "POST", body: JSON.stringify({ username, password }) });
}

export function logout(): Promise<{ ok: true }> {
  return request("/api/logout", { method: "POST" });
}

export function fetchMe(): Promise<Admin> {
  return request<Admin>("/api/me");
}

export interface ProfileInput {
  name: string;
  email: string;
  contact_no: string;
}

export function updateMyProfile(input: ProfileInput): Promise<Admin> {
  return request<Admin>("/api/me", { method: "PUT", body: JSON.stringify(input) });
}

export function changeMyPassword(currentPassword: string, newPassword: string): Promise<{ ok: true }> {
  return request("/api/me/password", { method: "PUT", body: JSON.stringify({ currentPassword, newPassword }) });
}

export function listAdmins(): Promise<Admin[]> {
  return request<Admin[]>("/api/admins");
}

export interface AdminCreateInput {
  username: string;
  password: string;
  role: "super_admin" | "admin";
  name: string;
  email: string;
  contact_no: string;
}

export function createAdmin(input: AdminCreateInput): Promise<{ id: number }> {
  return request("/api/admins", { method: "POST", body: JSON.stringify(input) });
}

export interface AdminUpdateInput {
  username: string;
  role: "super_admin" | "admin";
  name: string;
  email: string;
  contact_no: string;
}

export function updateAdmin(id: number, input: AdminUpdateInput): Promise<{ ok: true }> {
  return request(`/api/admins/${id}`, { method: "PUT", body: JSON.stringify(input) });
}

export function deleteAdmin(id: number): Promise<{ ok: true }> {
  return request(`/api/admins/${id}`, { method: "DELETE" });
}

export function resetAdminPassword(id: number, newPassword: string): Promise<{ ok: true }> {
  return request(`/api/admins/${id}/password`, { method: "PUT", body: JSON.stringify({ newPassword }) });
}

export function listApplications(): Promise<ApplicationSummary[]> {
  return request<ApplicationSummary[]>("/api/applications");
}

export function getApplication(id: number): Promise<ApplicationDetail> {
  return request<ApplicationDetail>(`/api/applications/${id}`);
}

export interface ApplicationFormInput {
  name: string;
  account_id: string;
  database_id: string;
  api_token?: string; // blank on edit means "keep existing token"
  field_schema: FieldSchemaEntry[];
  table_name: string;
}

export function createApplication(input: ApplicationFormInput): Promise<{ id: number }> {
  return request("/api/applications", { method: "POST", body: JSON.stringify(input) });
}

export function updateApplication(id: number, input: ApplicationFormInput): Promise<{ ok: true }> {
  return request(`/api/applications/${id}`, { method: "PUT", body: JSON.stringify(input) });
}

export function deleteApplication(id: number): Promise<{ ok: true }> {
  return request(`/api/applications/${id}`, { method: "DELETE" });
}

export function listApplicationUsers(id: number): Promise<UserListResponse> {
  return request<UserListResponse>(`/api/applications/${id}/users`);
}

export function updateApplicationUserField(
  id: number,
  field: string,
  value: unknown,
  primaryKeyValue: unknown
): Promise<{ ok: true; value: unknown }> {
  return request(`/api/applications/${id}/users`, {
    method: "PATCH",
    body: JSON.stringify({ field, value, primaryKeyValue }),
  });
}
