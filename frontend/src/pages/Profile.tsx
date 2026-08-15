import { useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";
import { updateMyProfile, changeMyPassword, ApiError } from "../api";
import { useToasts, ToastStack } from "../components/Toast";

export function Profile() {
  const { admin, refresh } = useAuth();
  const { toasts, pushToast } = useToasts();

  const [name, setName] = useState(admin?.name ?? "");
  const [email, setEmail] = useState(admin?.email ?? "");
  const [contactNo, setContactNo] = useState(admin?.contact_no ?? "");
  const [profileError, setProfileError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);

  if (!admin) return null;

  async function handleProfileSubmit(event: FormEvent) {
    event.preventDefault();
    setProfileError(null);
    setSavingProfile(true);
    try {
      await updateMyProfile({ name: name.trim(), email: email.trim(), contact_no: contactNo.trim() });
      await refresh();
      pushToast("Profile saved.", "success");
    } catch (err) {
      setProfileError(err instanceof ApiError ? err.message : "Failed to save profile.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePasswordSubmit(event: FormEvent) {
    event.preventDefault();
    setPasswordError(null);
    setChangingPassword(true);
    try {
      await changeMyPassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      pushToast("Password changed.", "success");
    } catch (err) {
      setPasswordError(err instanceof ApiError ? err.message : "Failed to change password.");
    } finally {
      setChangingPassword(false);
    }
  }

  return (
    <div>
      <h1>Your profile</h1>

      <form className="application-form" onSubmit={handleProfileSubmit}>
        <label>
          Username
          <input value={admin.username} disabled />
        </label>
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Contact number
          <input value={contactNo} onChange={(e) => setContactNo(e.target.value)} />
        </label>
        {profileError && <p className="form-error">{profileError}</p>}
        <button type="submit" disabled={savingProfile}>
          {savingProfile ? "Saving…" : "Save profile"}
        </button>
      </form>

      <h2>Change password</h2>
      <form className="application-form" onSubmit={handlePasswordSubmit}>
        <label>
          Current password
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        <label>
          New password
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>
        {passwordError && <p className="form-error">{passwordError}</p>}
        <button type="submit" disabled={changingPassword}>
          {changingPassword ? "Changing…" : "Change password"}
        </button>
      </form>

      <ToastStack toasts={toasts} />
    </div>
  );
}
