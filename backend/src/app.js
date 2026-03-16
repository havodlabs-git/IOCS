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

function createApp() {
  const app = express();

  // Confiar no proxy nginx para X-Forwarded-For (resolve aviso do express-rate-limit)
  app.set("trust proxy", 1);

  app.disable("x-powered-by");

  app.use(helmet());
  app.use(cors(corsOptions));
  app.options("*", cors(corsOptions)); // preflight para todas as rotas
  app.use(express.json({ limit: "1mb" }));
  app.use(morgan("combined"));

  // rate limit (principalmente para endpoints de token)
  app.use("/api/customer/token", rateLimit({ windowMs: 60_000, limit: 60 }));

  // Swagger (apenas acessível localmente via rede interna Docker)
  const openapiPath = path.join(process.cwd(), "openapi.yaml");
  const spec = YAML.parse(fs.readFileSync(openapiPath, "utf8"));
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(spec));
  app.get("/api/openapi.yaml", (req, res) => res.sendFile(openapiPath));

  // Rotas API
  app.get("/api/health", (req, res) => res.json({ ok: true }));

  app.use("/api/customer", customersRoutes);
  app.use("/api/IOCS", iocsRoutes);
  app.use("/api/mfa", mfaRoutes);

  // 404
  app.use((req, res) => res.status(404).json({ error: "NOT_FOUND" }));

  return app;
}

module.exports = { createApp };
