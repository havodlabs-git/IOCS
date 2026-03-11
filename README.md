# IOCs App — Frontend + Backend Integrados

sudo curl -L "https://github.com/docker/compose/releases/download/1.29.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose

Aplicação completa para gerenciamento de IOCs (Indicators of Compromise), composta por:

- **Frontend**: React + Vite + TailwindCSS (porta 80 via Nginx)
- **Backend**: Node.js + Express (porta 3000)
- **Banco de dados**: PostgreSQL 16 (porta 5432)

---

## Estrutura do Projeto

```
iocs-app/
├── docker-compose.yml        # Orquestração completa
├── README.md
├── backend/
│   ├── Dockerfile
│   ├── .env                  # Variáveis de ambiente do backend
│   ├── .env.example
│   ├── package.json
│   ├── openapi.yaml          # Documentação Swagger
│   └── src/
│       ├── index.js
│       ├── app.js
│       ├── auth.js
│       ├── db.js
│       └── routes/
│           ├── customers.js
│           └── iocs.js
└── frontend/
    ├── Dockerfile
    ├── nginx.conf            # Proxy reverso /api → backend
    ├── .env                  # Variáveis de ambiente do frontend
    ├── .env.example
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── index.html
    └── src/
        ├── main.tsx
        ├── app/
        │   ├── App.tsx
        │   ├── components/
        │   │   ├── AuthForm.tsx       # Login via Customer ID + Secret
        │   │   ├── IocUploader.tsx    # Upload de IOCs (CSV/JSON) → API real
        │   │   ├── IocTable.tsx
        │   │   ├── ui/               # Componentes Radix/shadcn
        │   │   └── figma/
        │   └── services/
        │       └── api.ts            # Camada de integração com o backend
        └── styles/
```

---

## Subir com Docker (recomendado)

### 1. Configurar variáveis de ambiente

Edite `backend/.env` antes de subir:

```env
JWT_SECRET=sua-chave-secreta-forte
ADMIN_API_KEY=sua-admin-key-forte
DATABASE_URL=postgres://ioc:iocpass@db:5432/iocdb
JWT_EXPIRES_IN=30d
BCRYPT_ROUNDS=12
```

### 2. Subir todos os serviços

```bash
docker compose up --build
```

Após a inicialização:

| Serviço    | URL                              |
|------------|----------------------------------|
| Frontend   | http://localhost                 |
| Backend API| http://localhost:3000            |
| Swagger UI | http://localhost:3000/api/docs   |

### 3. Parar os serviços

```bash
docker compose down
```

Para remover também o volume do banco:

```bash
docker compose down -v
```

---

## Desenvolvimento Local (sem Docker)

### Backend

```bash
cd backend
npm install
# Edite .env com DATABASE_URL apontando para seu Postgres local
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

O Vite dev server roda na porta **5173** e faz proxy automático de `/api/*` para `http://localhost:3000`.

---

## Fluxo de Autenticação

O frontend usa autenticação real via JWT:

1. **Registrar um customer** (via API direta ou Swagger):
   ```bash
   curl -X POST http://localhost:3000/api/customer/register \
     -H "Content-Type: application/json" \
     -d '{"name": "Minha Empresa"}'
   # Resposta: { "customerId": "...", "customerSecret": "..." }
   ```

2. **Fazer login no frontend**: insira o `customerId` e `customerSecret` na tela de login.

3. **Fazer upload de IOCs**: selecione um arquivo CSV ou JSON.

---

## Formato dos Arquivos de IOCs

### CSV

```csv
type,value,severity,description,tags,status,source
ip,192.168.1.1,high,IP suspeito,malware;botnet,active,SIEM
domain,evil.example.com,critical,Domínio malicioso,,active,TI
```

### JSON

```json
[
  {
    "type": "ip",
    "value": "192.168.1.1",
    "severity": "high",
    "description": "IP suspeito",
    "tags": ["malware", "botnet"],
    "status": "active",
    "source": "SIEM"
  }
]
```

---

## Endpoints da API

Consulte a documentação completa em **http://localhost:3000/api/docs** (Swagger UI).

| Método | Endpoint                        | Auth         | Descrição                         |
|--------|---------------------------------|--------------|-----------------------------------|
| GET    | /api/health                     | —            | Health check                      |
| POST   | /api/customer/register          | —            | Registrar novo customer           |
| POST   | /api/customer/token/create      | —            | Obter JWT (customerId + secret)   |
| POST   | /api/customer/token/auth        | —            | Validar token JWT                 |
| POST   | /api/IOCS/customer/add          | Bearer JWT   | Adicionar IOC do customer         |
| GET    | /api/IOCS/customer/list         | Bearer JWT   | Listar IOCs do customer           |
| DELETE | /api/IOCS/customer/delete       | Bearer JWT   | Deletar IOC do customer           |
| PUT    | /api/IOCS/customer/update       | Bearer JWT   | Atualizar IOC do customer         |
| POST   | /api/IOCS/add                   | Admin Key    | Adicionar IOC global              |
| GET    | /api/IOCS/list                  | Admin Key    | Listar IOCs globais               |
| DELETE | /api/IOCS/delete                | Admin Key    | Deletar IOC global                |
| PUT    | /api/IOCS/update                | Admin Key    | Atualizar IOC global              |
