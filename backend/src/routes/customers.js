const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");

const { pool } = require("../db");
const { issueCustomerToken, verifyToken } = require("../auth");

const router = express.Router();

function nowIso() {
  return new Date().toISOString();
}

function generateCustomerSecret() {
  return crypto.randomBytes(32).toString("base64url");
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

router.post("/register", async (req, res) => {
  try {
    const { name } = req.body || {};
    if (!name || String(name).trim().length < 2) {
      return res.status(400).json({ error: "INVALID_NAME" });
    }

    const customerId = uuidv4();
    const customerSecret = generateCustomerSecret();

    const rounds = Number(process.env.BCRYPT_ROUNDS || 12);
    const secretHash = await bcrypt.hash(customerSecret, rounds);

    await pool.query(
      `INSERT INTO customers (id, name, secret_hash, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [customerId, String(name).trim(), secretHash]
    );

    // Importante: o secret só deve ser exibido uma vez.
    return res.status(201).json({
      customerId,
      customerSecret
    });
  } catch (e) {
    return res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

router.post("/user/register", async (req, res) => {
  try {
    const { customerId, customerSecret, email, password } = req.body || {};

    if (!customerId) return res.status(400).json({ error: "CUSTOMER_ID_REQUIRED" });
    if (!customerSecret) return res.status(400).json({ error: "CUSTOMER_SECRET_REQUIRED" });

    const normEmail = normalizeEmail(email);
    if (!normEmail || !normEmail.includes("@")) {
      return res.status(400).json({ error: "INVALID_EMAIL" });
    }

    if (!password || String(password).length < 8) {
      return res.status(400).json({ error: "WEAK_PASSWORD_MIN_8" });
    }

    const custRes = await pool.query(
      "SELECT id, secret_hash FROM customers WHERE id = $1",
      [customerId]
    );
    if (custRes.rowCount === 0) return res.status(404).json({ error: "CUSTOMER_NOT_FOUND" });

    const customer = custRes.rows[0];
    const ok = await bcrypt.compare(String(customerSecret), customer.secret_hash);
    if (!ok) return res.status(401).json({ error: "INVALID_CUSTOMER_SECRET" });

    const rounds = Number(process.env.BCRYPT_ROUNDS || 12);
    const passwordHash = await bcrypt.hash(String(password), rounds);

    const userId = uuidv4();

    try {
      await pool.query(
        `INSERT INTO users (id, customer_id, email, password_hash, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [userId, customerId, normEmail, passwordHash]
      );
    } catch (err) {
      // Unique violation (customer_id, email)
      if (err && err.code === "23505") {
        return res.status(409).json({ error: "USER_ALREADY_EXISTS" });
      }
      throw err;
    }

    return res.status(201).json({
      userId,
      customerId,
      email: normEmail,
      createdAt: nowIso()
    });
  } catch {
    return res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

router.post("/token/create", async (req, res) => {
  try {
    const { customerId, customerSecret } = req.body || {};
    if (!customerId) return res.status(400).json({ error: "CUSTOMER_ID_REQUIRED" });
    if (!customerSecret) return res.status(400).json({ error: "CUSTOMER_SECRET_REQUIRED" });

    const custRes = await pool.query(
      "SELECT id, secret_hash FROM customers WHERE id = $1",
      [customerId]
    );
    if (custRes.rowCount === 0) return res.status(404).json({ error: "CUSTOMER_NOT_FOUND" });

    const customer = custRes.rows[0];
    const ok = await bcrypt.compare(String(customerSecret), customer.secret_hash);
    if (!ok) return res.status(401).json({ error: "INVALID_CUSTOMER_SECRET" });

    const token = issueCustomerToken(customerId);

    return res.status(200).json({
      token,
      tokenType: "Bearer",
      expiresIn: process.env.JWT_EXPIRES_IN || "12h"
    });
  } catch {
    return res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

/**
 * GET /api/customer/me
 * Retorna dados do customer autenticado (requer Bearer token)
 */
router.get("/me", async (req, res) => {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return res.status(401).json({ error: "TOKEN_REQUIRED" });
    let payload;
    try { payload = verifyToken(token); } catch { return res.status(401).json({ error: "INVALID_OR_EXPIRED_TOKEN" }); }
    const customerId = payload.customerId || payload.sub;
    if (!customerId) return res.status(401).json({ error: "INVALID_TOKEN_PAYLOAD" });
    const r = await pool.query(
      "SELECT id, name, created_at FROM customers WHERE id = $1",
      [customerId]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: "CUSTOMER_NOT_FOUND" });
    const c = r.rows[0];
    return res.status(200).json({ customerId: c.id, name: c.name, createdAt: c.created_at });
  } catch {
    return res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

router.post("/token/auth", (req, res) => {
  try {
    const { token } = req.body || {};
    if (!token) return res.status(400).json({ error: "TOKEN_REQUIRED" });

    const payload = verifyToken(String(token));
    return res.status(200).json({
      valid: true,
      payload
    });
  } catch {
    return res.status(401).json({ valid: false, error: "INVALID_OR_EXPIRED_TOKEN" });
  }
});

module.exports = router;
