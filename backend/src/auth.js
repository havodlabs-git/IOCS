const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "12h";

// Se ADMIN_API_KEY não estiver definida, gera uma chave aleatória segura e imprime nos logs.
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || (() => {
  const generated = crypto.randomBytes(32).toString("hex");
  console.warn("[AUTH] ADMIN_API_KEY não definida. Chave gerada automaticamente:");
  console.warn("[AUTH] X-Admin-Key:", generated);
  console.warn("[AUTH] Defina ADMIN_API_KEY como variável de ambiente para fixar este valor.");
  return generated;
})();

function getBearerToken(req) {
  const h = req.headers.authorization || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

function issueCustomerToken(customerId) {
  return jwt.sign(
    { customerId, scope: "customer" },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

function isAdmin(req) {
  const key = req.headers["x-admin-key"];
  return Boolean(ADMIN_API_KEY) && key === ADMIN_API_KEY;
}

function requireAdmin(req, res, next) {
  if (isAdmin(req)) {
    req.auth = { type: "admin" };
    return next();
  }
  return res.status(401).json({ error: "ADMIN_KEY_REQUIRED" });
}

/**
 * Permite admin OU bearer JWT.
 * Se `customerId` for informado na requisição, valida que bate com o token (exceto admin).
 */
function requireCustomerOrAdmin({ customerIdResolver }) {
  return (req, res, next) => {
    if (isAdmin(req)) {
      req.auth = { type: "admin" };
      return next();
    }

    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "BEARER_TOKEN_REQUIRED" });

    try {
      const payload = verifyToken(token);
      if (!payload || payload.scope !== "customer" || !payload.customerId) {
        return res.status(401).json({ error: "INVALID_TOKEN" });
      }

      req.auth = { type: "customer", customerId: payload.customerId, payload };

      const customerId = customerIdResolver ? customerIdResolver(req) : null;
      if (customerId && String(customerId) !== String(payload.customerId)) {
        return res.status(403).json({ error: "CUSTOMER_MISMATCH" });
      }

      return next();
    } catch {
      return res.status(401).json({ error: "INVALID_OR_EXPIRED_TOKEN" });
    }
  };
}

module.exports = {
  issueCustomerToken,
  verifyToken,
  requireAdmin,
  requireCustomerOrAdmin,
  isAdmin
};
