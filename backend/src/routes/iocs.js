const express = require("express");
const { v4: uuidv4 } = require("uuid");

const { pool } = require("../db");
const { requireAdmin, requireCustomerOrAdmin } = require("../auth");

const router = express.Router();

function normalizeStr(x) {
  return String(x || "").trim();
}
function normalizeType(x) {
  return normalizeStr(x).toLowerCase();
}
function normalizeValue(x) {
  return normalizeStr(x);
}
function parseBool(v, defaultValue) {
  if (v === undefined || v === null) return defaultValue;
  if (typeof v === "boolean") return v;
  const s = String(v).toLowerCase();
  return ["1", "true", "yes", "y", "on"].includes(s);
}

function normalizeTags(tags, { forCreate }) {
  if (tags === undefined) return forCreate ? [] : undefined;
  if (tags === null) return [];
  if (!Array.isArray(tags) || !tags.every(t => typeof t === "string")) return "__INVALID__";
  return tags.map(t => normalizeStr(t)).filter(Boolean);
}

function normalizeSeverity(sev) {
  if (sev === undefined) return undefined;
  if (sev === null) return null;
  const n = Number(sev);
  if (!Number.isFinite(n)) return "__INVALID__";
  if (n < 0 || n > 10) return "__INVALID__";
  return Math.trunc(n);
}

function normalizeStatus(status, { forCreate }) {
  if (status === undefined) return forCreate ? "active" : undefined;
  if (status === null) return "__INVALID__";
  const s = normalizeStr(status).toLowerCase();
  if (!["active", "inactive"].includes(s)) return "__INVALID__";
  return s;
}

function normalizeIocPayload(payload, { forCreate }) {
  const type = normalizeType(payload.type);
  const value = normalizeValue(payload.value);

  if (!type) return { ok: false, error: "IOC_TYPE_REQUIRED" };
  if (!value) return { ok: false, error: "IOC_VALUE_REQUIRED" };

  const severity = normalizeSeverity(payload.severity);
  if (severity === "__INVALID__") return { ok: false, error: "INVALID_SEVERITY_0_10" };

  const tags = normalizeTags(payload.tags, { forCreate });
  if (tags === "__INVALID__") return { ok: false, error: "INVALID_TAGS_ARRAY" };

  const status = normalizeStatus(payload.status, { forCreate });
  if (status === "__INVALID__") return { ok: false, error: "INVALID_STATUS_ACTIVE_INACTIVE" };

  const description = payload.description !== undefined ? normalizeStr(payload.description) : (forCreate ? "" : undefined);
  const source = payload.source !== undefined ? normalizeStr(payload.source) : (forCreate ? "" : undefined);

  return {
    ok: true,
    data: {
      type,
      value,
      description,
      severity: severity === undefined ? (forCreate ? null : undefined) : severity,
      tags,
      status,
      source
    }
  };
}

function mapRow(row) {
  // Postgres retorna snake_case; normaliza para camelCase
  return {
    id: row.id,
    scope: row.scope,
    customerId: row.customer_id,
    type: row.type,
    value: row.value,
    description: row.description,
    severity: row.severity,
    tags: row.tags || [],
    status: row.status,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * GET /api/IOCS/list (ADMIN)
 * Lista todos os IOCs de todos os clientes + globais.
 */
router.get("/list", requireAdmin, async (req, res) => {
  try {
    const r = await pool.query(
      "SELECT * FROM iocs ORDER BY created_at DESC"
    );
    return res.status(200).json({ data: r.rows.map(mapRow) });
  } catch {
    return res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

/**
 * GET /api/IOCS/customer/list?customerId=...&includeGlobal=true
 * Lista os IOCs efetivos de um customer (CUSTOMER + opcionalmente GLOBAL).
 * Requer Bearer do próprio customer OU ADMIN.
 */
router.get(
  "/customer/list",
  requireCustomerOrAdmin({ customerIdResolver: (req) => req.query.customerId }),
  async (req, res) => {
    try {
      const customerId = String(req.query.customerId || "");
      if (!customerId) return res.status(400).json({ error: "CUSTOMER_ID_REQUIRED" });

      const includeGlobal = parseBool(req.query.includeGlobal, true);

      const r = includeGlobal
        ? await pool.query(
            `SELECT * FROM iocs
             WHERE scope = 'GLOBAL' OR (scope = 'CUSTOMER' AND customer_id = $1)
             ORDER BY created_at DESC`,
            [customerId]
          )
        : await pool.query(
            `SELECT * FROM iocs
             WHERE scope = 'CUSTOMER' AND customer_id = $1
             ORDER BY created_at DESC`,
            [customerId]
          );

      return res.status(200).json({
        customerId,
        includeGlobal,
        data: r.rows.map(mapRow)
      });
    } catch {
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

/**
 * POST /api/IOCS/add (ADMIN)
 * Adiciona um IOC GLOBAL (para todos os clientes)
 */
router.post("/add", requireAdmin, async (req, res) => {
  try {
    const v = normalizeIocPayload(req.body || {}, { forCreate: true });
    if (!v.ok) return res.status(400).json({ error: v.error });

    const ioc = {
      id: uuidv4(),
      scope: "GLOBAL",
      customerId: null,
      ...v.data
    };

    try {
      const r = await pool.query(
        `INSERT INTO iocs (id, scope, customer_id, type, value, description, severity, tags, status, source, created_at, updated_at)
         VALUES ($1, 'GLOBAL', NULL, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
         RETURNING *`,
        [
          ioc.id,
          ioc.type,
          ioc.value,
          ioc.description,
          ioc.severity,
          ioc.tags,
          ioc.status,
          ioc.source
        ]
      );
      return res.status(201).json({ data: mapRow(r.rows[0]) });
    } catch (err) {
      if (err && err.code === "23505") return res.status(409).json({ error: "DUPLICATE_IOC" });
      throw err;
    }
  } catch {
    return res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

/**
 * POST /api/IOCS/customer/add (CUSTOMER/ADMIN)
 * Adiciona um IOC CUSTOMER (específico de um customerId)
 */
router.post(
  "/customer/add",
  requireCustomerOrAdmin({ customerIdResolver: (req) => (req.body || {}).customerId }),
  async (req, res) => {
    try {
      const { customerId, ...iocPayload } = req.body || {};
      if (!customerId) return res.status(400).json({ error: "CUSTOMER_ID_REQUIRED" });

      // valida customer existente
      const c = await pool.query("SELECT 1 FROM customers WHERE id = $1", [customerId]);
      if (c.rowCount === 0) return res.status(404).json({ error: "CUSTOMER_NOT_FOUND" });

      const v = normalizeIocPayload(iocPayload, { forCreate: true });
      if (!v.ok) return res.status(400).json({ error: v.error });

      const id = uuidv4();

      try {
        const r = await pool.query(
          `INSERT INTO iocs (id, scope, customer_id, type, value, description, severity, tags, status, source, created_at, updated_at)
           VALUES ($1, 'CUSTOMER', $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
           RETURNING *`,
          [
            id,
            customerId,
            v.data.type,
            v.data.value,
            v.data.description,
            v.data.severity,
            v.data.tags,
            v.data.status,
            v.data.source
          ]
        );
        return res.status(201).json({ data: mapRow(r.rows[0]) });
      } catch (err) {
        if (err && err.code === "23505") return res.status(409).json({ error: "DUPLICATE_IOC" });
        throw err;
      }
    } catch {
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

/**
 * POST /api/IOCS/customer/share (CUSTOMER/ADMIN)
 * Promove um IOC CUSTOMER para GLOBAL (cria uma cópia com scope=GLOBAL).
 * O IOC original CUSTOMER é mantido.
 */
router.post(
  "/customer/share",
  requireCustomerOrAdmin({ customerIdResolver: (req) => (req.body || {}).customerId }),
  async (req, res) => {
    try {
      const { customerId, id } = req.body || {};
      if (!customerId) return res.status(400).json({ error: "CUSTOMER_ID_REQUIRED" });
      if (!id) return res.status(400).json({ error: "IOC_ID_REQUIRED" });

      // Busca o IOC CUSTOMER do solicitante
      const cur = await pool.query(
        "SELECT * FROM iocs WHERE id = $1 AND scope = 'CUSTOMER' AND customer_id = $2",
        [id, customerId]
      );
      if (cur.rowCount === 0) return res.status(404).json({ error: "IOC_NOT_FOUND" });
      const src = mapRow(cur.rows[0]);

      // Cria cópia GLOBAL (sem customer_id)
      const newId = uuidv4();
      try {
        const r = await pool.query(
          `INSERT INTO iocs (id, scope, customer_id, type, value, description, severity, tags, status, source, created_at, updated_at)
           VALUES ($1, 'GLOBAL', NULL, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
           RETURNING *`,
          [newId, src.type, src.value, src.description ?? "", src.severity, src.tags || [], src.status, src.source ?? ""]
        );
        return res.status(201).json({ data: mapRow(r.rows[0]), sharedFrom: id });
      } catch (err) {
        if (err && err.code === "23505") return res.status(409).json({ error: "IOC_ALREADY_GLOBAL" });
        throw err;
      }
    } catch {
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

/**
 * DELETE /api/IOCS/delete?id=... (ADMIN)
 * Deleta um IOC GLOBAL por id
 */
router.delete("/delete", requireAdmin, async (req, res) => {
  try {
    const id = String(req.query.id || "");
    if (!id) return res.status(400).json({ error: "IOC_ID_REQUIRED" });

    const r = await pool.query(
      "DELETE FROM iocs WHERE id = $1 AND scope = 'GLOBAL' RETURNING *",
      [id]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: "IOC_NOT_FOUND" });

    return res.status(200).json({ data: mapRow(r.rows[0]) });
  } catch {
    return res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

/**
 * DELETE /api/IOCS/customer/delete?customerId=...&id=... (CUSTOMER/ADMIN)
 * Deleta um IOC CUSTOMER por id + customerId
 */
router.delete(
  "/customer/delete",
  requireCustomerOrAdmin({ customerIdResolver: (req) => req.query.customerId }),
  async (req, res) => {
    try {
      const customerId = String(req.query.customerId || "");
      const id = String(req.query.id || "");

      if (!customerId) return res.status(400).json({ error: "CUSTOMER_ID_REQUIRED" });
      if (!id) return res.status(400).json({ error: "IOC_ID_REQUIRED" });

      const r = await pool.query(
        "DELETE FROM iocs WHERE id = $1 AND scope = 'CUSTOMER' AND customer_id = $2 RETURNING *",
        [id, customerId]
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "IOC_NOT_FOUND" });

      return res.status(200).json({ data: mapRow(r.rows[0]) });
    } catch {
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

/**
 * PUT /api/IOCS/update (ADMIN)
 * Atualiza IOC GLOBAL por id
 */
router.put("/update", requireAdmin, async (req, res) => {
  try {
    const { id, ...patch } = req.body || {};
    if (!id) return res.status(400).json({ error: "IOC_ID_REQUIRED" });

    const cur = await pool.query("SELECT * FROM iocs WHERE id = $1 AND scope = 'GLOBAL'", [id]);
    if (cur.rowCount === 0) return res.status(404).json({ error: "IOC_NOT_FOUND" });

    const current = mapRow(cur.rows[0]);

    // Merge patch -> objeto completo para validação
    const merged = {
      type: patch.type !== undefined ? patch.type : current.type,
      value: patch.value !== undefined ? patch.value : current.value,
      description: patch.description !== undefined ? patch.description : current.description,
      severity: patch.severity !== undefined ? patch.severity : current.severity,
      tags: patch.tags !== undefined ? patch.tags : current.tags,
      status: patch.status !== undefined ? patch.status : current.status,
      source: patch.source !== undefined ? patch.source : current.source
    };

    const v = normalizeIocPayload(merged, { forCreate: false });
    if (!v.ok) return res.status(400).json({ error: v.error });

    const data = {
      ...current,
      ...v.data
    };

    try {
      const r = await pool.query(
        `UPDATE iocs
         SET type = $1, value = $2, description = $3, severity = $4, tags = $5, status = $6, source = $7, updated_at = NOW()
         WHERE id = $8 AND scope = 'GLOBAL'
         RETURNING *`,
        [
          data.type,
          data.value,
          data.description ?? "",
          data.severity,
          data.tags || [],
          data.status,
          data.source ?? "",
          id
        ]
      );
      return res.status(200).json({ data: mapRow(r.rows[0]) });
    } catch (err) {
      if (err && err.code === "23505") return res.status(409).json({ error: "DUPLICATE_IOC" });
      throw err;
    }
  } catch {
    return res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

/**
 * PUT /api/IOCS/customer/update (CUSTOMER/ADMIN)
 * Atualiza IOC CUSTOMER por customerId + id
 */
router.put(
  "/customer/update",
  requireCustomerOrAdmin({ customerIdResolver: (req) => (req.body || {}).customerId }),
  async (req, res) => {
    try {
      const { customerId, id, ...patch } = req.body || {};
      if (!customerId) return res.status(400).json({ error: "CUSTOMER_ID_REQUIRED" });
      if (!id) return res.status(400).json({ error: "IOC_ID_REQUIRED" });

      const cur = await pool.query(
        "SELECT * FROM iocs WHERE id = $1 AND scope = 'CUSTOMER' AND customer_id = $2",
        [id, customerId]
      );
      if (cur.rowCount === 0) return res.status(404).json({ error: "IOC_NOT_FOUND" });

      const current = mapRow(cur.rows[0]);

      const merged = {
        type: patch.type !== undefined ? patch.type : current.type,
        value: patch.value !== undefined ? patch.value : current.value,
        description: patch.description !== undefined ? patch.description : current.description,
        severity: patch.severity !== undefined ? patch.severity : current.severity,
        tags: patch.tags !== undefined ? patch.tags : current.tags,
        status: patch.status !== undefined ? patch.status : current.status,
        source: patch.source !== undefined ? patch.source : current.source
      };

      const v = normalizeIocPayload(merged, { forCreate: false });
      if (!v.ok) return res.status(400).json({ error: v.error });

      const data = { ...current, ...v.data };

      try {
        const r = await pool.query(
          `UPDATE iocs
           SET type = $1, value = $2, description = $3, severity = $4, tags = $5, status = $6, source = $7, updated_at = NOW()
           WHERE id = $8 AND scope = 'CUSTOMER' AND customer_id = $9
           RETURNING *`,
          [
            data.type,
            data.value,
            data.description ?? "",
            data.severity,
            data.tags || [],
            data.status,
            data.source ?? "",
            id,
            customerId
          ]
        );
        return res.status(200).json({ data: mapRow(r.rows[0]) });
      } catch (err) {
        if (err && err.code === "23505") return res.status(409).json({ error: "DUPLICATE_IOC" });
        throw err;
      }
    } catch {
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

module.exports = router;
