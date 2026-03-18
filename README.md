# IOCs App — Frontend + Backend Integrados

Aplicação completa para gestão de IOCs (Indicators of Compromise), composta por:

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
│           ├── iocs.js
│           └── mfa.js
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
        └── app/
            ├── App.tsx
            ├── components/
            │   ├── AuthForm.tsx       # Login customer + admin
            │   ├── AdminPanel.tsx     # Painel de administração Blue Team
            │   ├── IocUploader.tsx    # Upload de IOCs (CSV/JSON)
            │   ├── IocTable.tsx
            │   └── ui/
            └── services/
                └── api.ts            # Camada de integração com o backend
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

> **Importante**: se `ADMIN_API_KEY` não for definida, o backend gera uma chave aleatória no arranque e imprime-a nos logs do container `api`. Consulte os logs com `docker compose logs api | grep "X-Admin-Key"`.

### 2. Subir todos os serviços

```bash
docker compose up --build
```

Após a inicialização:

| Serviço     | URL                            |
|-------------|--------------------------------|
| Frontend    | http://localhost               |
| Backend API | http://localhost:3000          |
| Swagger UI  | http://localhost:3000/api/docs |

### 3. Parar os serviços

```bash
docker compose down
```

Para remover também o volume do banco:

```bash
docker compose down -v
```

---

## Painel de Administração (Blue Team)

O frontend inclui um painel de administração completo, acessível directamente através do ecrã de login.

### Como aceder

1. No ecrã de login, introduza:
   - **Customer ID**: `admin`
   - **Customer Secret**: o valor da `ADMIN_API_KEY` (ver logs do container `api`)
2. Clique em **Autenticar**.

O sistema detecta o login admin, valida a chave contra o backend e apresenta o painel de administração em vez do portal de customer.

### Funcionalidades do painel admin

| Secção          | Descrição                                                                 |
|-----------------|---------------------------------------------------------------------------|
| **Dashboard**   | Estatísticas globais: nº de customers, IOCs globais, pendentes, total     |
| **Pendentes**   | Lista de IOCs aguardando aprovação Blue Team — botões Aprovar / Rejeitar  |
| **IOCs Globais**| Todos os IOCs aprovados no pool global — botão Remover                    |
| **Customers**   | Lista de customers registados com contagem de IOCs — botão Remover        |

### Sessão admin persistente

A sessão admin é guardada em `localStorage` (chave `cwo_admin_session`). Ao refrescar a página, o sistema re-valida a chave contra o backend automaticamente.

---

## Fluxo de Aprovação de IOCs (Blue Team)

1. **Customer submete IOC**: `POST /api/IOCS/customer/add` → IOC fica com `scope=CUSTOMER`.
2. **Customer partilha IOC**: `POST /api/IOCS/customer/share` → IOC passa a `scope=GLOBAL, approvalStatus=PENDING`.
3. **Admin aprova**: via painel admin ou `POST /api/IOCS/blueteam/approve` com `X-Admin-Key` → `approvalStatus=APPROVED`, visível globalmente.
4. **Admin rejeita**: via painel admin ou `POST /api/IOCS/blueteam/reject` → IOC devolvido ao customer como `scope=CUSTOMER`.

---

## Fluxo de Autenticação de Customers

1. **Registar um customer** (via API ou Swagger):
   ```bash
   curl -X POST http://localhost:3000/api/customer/register \
     -H "Content-Type: application/json" \
     -d '{"name": "Minha Empresa"}'
   # Resposta: { "customerId": "...", "customerSecret": "..." }
   ```

2. **Fazer login no frontend**: inserir o `customerId` e `customerSecret` no ecrã de login.

3. **Fazer upload de IOCs**: seleccionar um ficheiro CSV ou JSON.

---

## Formato dos Ficheiros de IOCs

### CSV

```csv
type,value,severity,description,tags,status,source
ip,192.168.1.1,7,IP suspeito,malware;botnet,active,SIEM
domain,evil.example.com,9,Domínio malicioso,,active,TI
```

### JSON

```json
[
  {
    "type": "ip",
    "value": "192.168.1.1",
    "severity": 7,
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

### Customers

| Método | Endpoint                   | Auth      | Descrição                       |
|--------|----------------------------|-----------|---------------------------------|
| POST   | /api/customer/register     | —         | Registar novo customer          |
| POST   | /api/customer/token/create | —         | Obter JWT                       |
| POST   | /api/customer/token/auth   | —         | Validar token JWT               |
| GET    | /api/customer/me           | Bearer    | Dados do customer autenticado   |
| GET    | /api/customer/list         | Admin Key | Listar todos os customers       |
| DELETE | /api/customer/delete?id=   | Admin Key | Remover customer                |

### IOCs — Customer

| Método | Endpoint                  | Auth   | Descrição                         |
|--------|---------------------------|--------|-----------------------------------|
| POST   | /api/IOCS/customer/add    | Bearer | Adicionar IOC do customer         |
| GET    | /api/IOCS/customer/list   | Bearer | Listar IOCs do customer           |
| DELETE | /api/IOCS/customer/delete | Bearer | Remover IOC do customer           |
| PUT    | /api/IOCS/customer/update | Bearer | Actualizar IOC do customer        |
| POST   | /api/IOCS/customer/share  | Bearer | Partilhar IOC para aprovação      |

### IOCs — Admin

| Método | Endpoint                    | Auth      | Descrição                        |
|--------|-----------------------------|-----------|----------------------------------|
| POST   | /api/IOCS/add               | Admin Key | Adicionar IOC global             |
| GET    | /api/IOCS/list              | Admin Key | Listar todos os IOCs             |
| DELETE | /api/IOCS/delete?id=        | Admin Key | Remover IOC global               |
| PUT    | /api/IOCS/update            | Admin Key | Actualizar IOC global            |

### Blue Team (Aprovações)

| Método | Endpoint                    | Auth      | Descrição                        |
|--------|-----------------------------|-----------|----------------------------------|
| GET    | /api/IOCS/blueteam/pending  | Admin Key | Listar IOCs pendentes            |
| GET    | /api/IOCS/blueteam/global   | Admin Key | Listar IOCs globais aprovados    |
| POST   | /api/IOCS/blueteam/approve  | Admin Key | Aprovar IOC pendente             |
| POST   | /api/IOCS/blueteam/reject   | Admin Key | Rejeitar/revogar IOC             |

### MFA

| Método | Endpoint           | Auth   | Descrição                          |
|--------|--------------------|--------|------------------------------------|
| GET    | /api/mfa/status    | Bearer | Estado do MFA do customer          |
| POST   | /api/mfa/setup     | Bearer | Configurar TOTP (QR code)          |
| POST   | /api/mfa/verify    | Bearer | Activar MFA com código TOTP        |
| POST   | /api/mfa/disable   | Bearer | Desactivar MFA                     |
| POST   | /api/mfa/validate  | —      | Validar código MFA no login        |

### Outros

| Método | Endpoint    | Auth | Descrição     |
|--------|-------------|------|---------------|
| GET    | /api/health | —    | Health check  |
