import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Bindings, Variables } from "./types";
import { sessionMiddleware, requireSuperAdmin } from "./auth";
import { authRoutes } from "./routes/auth";
import { applicationRoutes } from "./routes/applications";
import { userListRoutes } from "./routes/users";
import { meRoutes } from "./routes/me";
import { adminRoutes } from "./routes/admins";

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.use("*", async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Referrer-Policy", "no-referrer");
});

app.use("*", async (c, next) => {
  const middleware = cors({
    origin: c.env.ALLOWED_ORIGIN,
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });
  return middleware(c, next);
});

app.route("/api", authRoutes);

// Everything below requires a valid session (both the exact list/create path and nested ones).
app.use("/api/me", sessionMiddleware);
app.use("/api/me/*", sessionMiddleware);
app.use("/api/applications", sessionMiddleware);
app.use("/api/applications/*", sessionMiddleware);
app.route("/api/me", meRoutes);
app.route("/api/applications", applicationRoutes);
app.route("/api/applications", userListRoutes);

// Account management (add/remove/edit *other* admins) is super_admin-only.
app.use("/api/admins", sessionMiddleware, requireSuperAdmin);
app.use("/api/admins/*", sessionMiddleware, requireSuperAdmin);
app.route("/api/admins", adminRoutes);

app.notFound((c) => c.json({ error: "Not found" }, 404));

export default app;
