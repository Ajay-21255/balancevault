require("dotenv").config();

const express = require("express");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const prisma = require("./db");
const redis = require("./redis");
const { sign, requireAuth, requireAdmin } = require("./auth");
const audit = require("./audit");

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json());

app.use(rateLimit({
  windowMs: 60 * 1000,
  limit: 100,
  legacyHeaders: false,
}));

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/ready", async (req, res) => {
  let dbReady = true;
  let redisReady = redis ? true : "skipped";

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    console.error("Database readiness check failed:", error);
    dbReady = false;
  }

  if (redis) {
    try {
      await redis.ping();
    } catch (error) {
      console.error("Redis readiness check failed:", error);
      redisReady = false;
    }
  }

  return res.status(dbReady ? 200 : 503).json({ db: dbReady, redis: redisReady });
});

app.post("/auth/register", async (req, res) => {
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "A valid email is required" });
  }
  if (!name) {
    return res.status(400).json({ error: "A name is required" });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  let user;
  try {
    user = await prisma.user.create({
      data: { email, name, password: hashedPassword },
    });
  } catch (error) {
    if (error && error.code === "P2002") {
      return res.status(409).json({ error: "An account with that email already exists" });
    }
    throw error;
  }

  await audit.log(user.id, "USER_REGISTERED", user.id, { email: user.email });
  return res.status(201).json(publicUser(user));
});

app.post("/auth/login", async (req, res) => {
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  const user = email
    ? await prisma.user.findUnique({ where: { email } })
    : null;
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: "invalid credentials" });
  }


  await audit.log(user.id, "USER_LOGIN", user.id, { email: user.email });
  return res.json({
    token: sign(user),
    user: { ...publicUser(user), status: user.status },
  });
});

app.get("/accounts", requireAuth, async (req, res) => {
  const accounts = await prisma.account.findMany({
    where: { ownerId: req.user.id },
    orderBy: { createdAt: "desc" },
  });
  return res.json({ accounts });
});

app.post("/accounts", requireAuth, async (req, res) => {
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const currency = body.currency === undefined ? "USD" : body.currency;
  if (typeof currency !== "string" || !currency.trim()) {
    return res.status(400).json({ error: "Currency must be a non-empty string" });
  }

  const account = await prisma.account.create({
    data: { ownerId: req.user.id, currency: currency.trim() },
  });
  await audit.log(req.user.id, "ACCOUNT_CREATED", account.id, { currency: account.currency });
  return res.status(201).json({ account });
});

app.get("/admin/users", requireAuth, requireAdmin, async (req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, status: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return res.json({ users });
});

app.post("/admin/users/:id/approve", requireAuth, requireAdmin, async (req, res) => {
  let user;
  try {
    user = await prisma.user.update({
      where: { id: req.params.id },
      data: { status: "ACTIVE" },
      select: { id: true, email: true, name: true, role: true, status: true, createdAt: true },
    });
  } catch (error) {
    if (error && error.code === "P2025") {
      return res.status(404).json({ error: "User not found" });
    }
    throw error;
  }

  await audit.log(req.user.id, "USER_APPROVED", user.id, { email: user.email });
  return res.json(user);
});

app.get("/admin/audit-logs", requireAuth, requireAdmin, async (req, res) => {
  const auditLogs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return res.json({ auditLogs });
});

app.use((error, req, res, next) => {
  console.error("Request failed:", error);
  if (res.headersSent) {
    return next(error);
  }
  return res.status(500).json({ error: "Internal server error" });
});

if (require.main === module) {
  const port = process.env.PORT || 4000;
  app.listen(port, () => {
    console.log(`API on ${port}`);
  });
}

module.exports = app;
