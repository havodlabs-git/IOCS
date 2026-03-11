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

function createApp() {
  const app = express();
  app.disable("x-powered-by");

  app.use(helmet());
  app.use(cors({ origin: '*', methods: ['GET','POST','PUT','DELETE','PATCH','OPTIONS'], allowedHeaders: ['Content-Type','Authorization','X-Admin-Key'] }));
  app.use(express.json({ limit: "1mb" }));
  app.use(morgan("combined"));

  // rate limit (principalmente para endpoints de token)
  app.use("/api/customer/token", rateLimit({ windowMs: 60_000, limit: 60 }));

  // Swagger
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
