const jwt = require("jsonwebtoken");

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET must be set");
  }
  return secret;
}

function sign(user) {
  return jwt.sign(
    { sub: user.id, role: user.role },
    getJwtSecret(),
    { expiresIn: "7d" },
  );
}

function requireAuth(req, res, next) {
  const authorization = req.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return res.status(401).json({ error: "Authentication required" });
  }

  let secret;
  try {
    secret = getJwtSecret();
  } catch (error) {
    return next(error);
  }

  let payload;
  try {
    payload = jwt.verify(match[1], secret);
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  if (
    !payload ||
    typeof payload === "string" ||
    typeof payload.sub !== "string" ||
    (payload.role !== "USER" && payload.role !== "ADMIN")
  ) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  req.user = { id: payload.sub, role: payload.role };
  return next();
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Forbidden" });
  }
  return next();
}

module.exports = { sign, requireAuth, requireAdmin };
