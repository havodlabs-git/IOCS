const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const fs = require("fs");
const path = require("path");
const YAML = require("yaml");
const swaggerUi = require("swagger-ui-express");

const customersRoutes = require("./routes/customers");
const iocsRoutes = require("./routes/iocs");
const mfaRoutes = require("./routes/mfa");

// Origens permitidas: variável de ambiente ou o IP/domínio do servidor
const ALLOWED_ORIGINS = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim())
  : [
      "https://212.55.149.114:4545",
    ];

const corsOptions = {
  origin: (origin, callback) => {
    // Permitir pedidos sem origin (ex: curl, Postman, mobile apps internas)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    return callback(new Error("CORS_ORIGIN_NOT_ALLOWED"), false);
  },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

// Middleware que bloqueia acesso externo ao Swagger/OpenAPI
// Apenas permite acesso a partir da rede interna Docker (172.x.x.x ou 127.x.x.x)
function internalOnly(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || "";
  const isInternal =
    ip.startsWith("127.") ||
    ip.startsWith("::1") ||
    ip.startsWith("172.") ||
    ip.startsWith("10.") ||
    ip === "::ffff:127.0.0.1";
  if (!isInternal) {
    return res.status(404).json({ error: "NOT_FOUND" });
  }
  return next();
}

function createApp() {
  const app = express();

  // Confiar no proxy nginx para X-Forwarded-For (resolve aviso do express-rate-limit)
  app.set("trust proxy", 1);

  app.disable("x-powered-by");

  // Helmet configurado para NÃO definir os headers que o nginx já gere.
  // Isto evita duplicação de headers (Finding #5 do re-test pentest).
  // O nginx define: HSTS, X-Frame-Options, X-Content-Type-Options,
  // X-XSS-Protection, Referrer-Policy, CSP, COOP, CORP.
  app.use(helmet({
    // Desactivar headers geridos pelo nginx
    strictTransportSecurity: false,
    xFrameOptions: false,
    xContentTypeOptions: false,
    xXssProtection: false,
    referrerPolicy: false,
    contentSecurityPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
    // Manter apenas o que o nginx não define
    dnsPrefetchControl: { allow: false },
    permittedCrossDomainPolicies: false,
    originAgentCluster: false,
  }));
  app.use(cors(corsOptions));
  app.options("*", cors(corsOptions)); // preflight para todas as rotas
  app.use(express.json({ limit: "1mb" }));
  app.use(morgan("combined"));

  // rate limit (principalmente para endpoints de token)
  app.use("/api/customer/token", rateLimit({ windowMs: 60_000, limit: 60 }));

  // Swagger — acessível externamente (desactivar quando não necessário)
  const openapiPath = path.join(process.cwd(), "openapi.yaml");
  const spec = YAML.parse(fs.readFileSync(openapiPath, "utf8"));
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(spec));
  app.get("/api/openapi.yaml", (req, res) => res.sendFile(openapiPath));

  // Rotas API
  app.get("/api/health", (req, res) => res.json({ ok: true }));

  app.use("/api/customer", customersRoutes);
  app.use("/api/IOCS", iocsRoutes);
  app.use("/api/mfa", mfaRoutes);

  // 404 — mensagem genérica sem revelar estrutura interna
  app.use((req, res) => res.status(404).json({ error: "NOT_FOUND" }));

  // Handler de erro global — nunca expõe stack traces ou detalhes internos
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    // Log interno para debugging (não exposto ao cliente)
    console.error("[ERROR]", err.message || err);

    // Erros de CORS
    if (err.message === "CORS_ORIGIN_NOT_ALLOWED") {
      return res.status(403).json({ error: "FORBIDDEN" });
    }

    // Todos os outros erros — resposta genérica
    return res.status(500).json({ error: "INTERNAL_ERROR" });
  });

  return app;
}

module.exports = { createApp };
