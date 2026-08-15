import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { RequireAuth } from "./auth/RequireAuth";
import { RequireSuperAdmin } from "./auth/RequireSuperAdmin";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Applications } from "./pages/Applications";
import { ApplicationUsers } from "./pages/ApplicationUsers";
import { Settings } from "./pages/Settings";
import { ApplicationFormPage } from "./pages/ApplicationFormPage";
import { Profile } from "./pages/Profile";
import { Users } from "./pages/Users";
import { UserFormPage } from "./pages/UserFormPage";

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<RequireAuth />}>
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/applications" element={<Applications />} />
              <Route path="/applications/:id" element={<ApplicationUsers />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/settings/new" element={<ApplicationFormPage />} />
              <Route path="/settings/:id/edit" element={<ApplicationFormPage />} />
              <Route path="/profile" element={<Profile />} />
              <Route element={<RequireSuperAdmin />}>
                <Route path="/users" element={<Users />} />
                <Route path="/users/new" element={<UserFormPage />} />
                <Route path="/users/:id/edit" element={<UserFormPage />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
