require("dotenv").config();

const { createApp } = require("./app");
const { waitForDb, initDb } = require("./db");

const PORT = Number(process.env.PORT || 3000);

async function main() {
  
  await waitForDb({ maxAttempts: 60, delayMs: 1000 });

  // Cria tabelas/índices se não existirem
  await initDb();

  const app = createApp();
  app.listen(PORT, () => {
    console.log(`IOC backend rodando em http://localhost:${PORT}`);
    console.log(`Swagger UI: http://localhost:${PORT}/api/docs`);
    console.log(`OpenAPI YAML: http://localhost:${PORT}/api/openapi.yaml`);
  });
}

main().catch((err) => {
  console.error("[FATAL] Falha ao iniciar:", err);
  process.exit(1);
});
