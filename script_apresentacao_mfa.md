# Script de Apresentação — Implementação de MFA com Microsoft Authenticator
### CWO - IOC Manager · Segurança de Acesso

---

## Slide 1 — Abertura

> "Bom dia / Boa tarde a todos. Hoje vou apresentar a implementação da autenticação de dois fatores no CWO - IOC Manager, utilizando o Microsoft Authenticator como segundo fator de verificação."

O CWO - IOC Manager é uma plataforma de gestão de Indicadores de Comprometimento (IOCs) desenvolvida para equipas de segurança. Dado o carácter sensível dos dados que a plataforma gere — endereços IP maliciosos, domínios comprometidos, hashes de malware — a proteção do acesso é uma prioridade crítica. A implementação de MFA representa uma camada adicional de defesa que vai além da simples combinação de credenciais.

---

## Slide 2 — O Problema: Credenciais Não São Suficientes

> "Antes de mostrar a solução, é importante contextualizar o problema que o MFA resolve."

As credenciais estáticas — Customer ID e Customer Secret — são vulneráveis a um conjunto de ataques bem documentados: phishing, credential stuffing, ataques de força bruta e exposição acidental em repositórios de código. Segundo estudos da indústria, mais de 80% dos incidentes de comprometimento de contas envolvem credenciais roubadas ou fracas. O MFA elimina este vetor de ataque ao exigir um segundo fator que o atacante não possui — mesmo que tenha obtido as credenciais.

---

## Slide 3 — A Solução: TOTP com Microsoft Authenticator

> "A solução escolhida foi o protocolo TOTP — Time-based One-Time Password — standardizado na RFC 6238, e compatível com o Microsoft Authenticator."

O TOTP funciona da seguinte forma: durante a configuração, o servidor gera um segredo criptográfico único por utilizador. Este segredo é partilhado com a aplicação Microsoft Authenticator através de um QR Code. A partir desse momento, tanto o servidor como a aplicação geram, de forma independente, um código de 6 dígitos que muda a cada 30 segundos, utilizando o mesmo algoritmo HMAC-SHA1 sobre o segredo e o timestamp atual. A verificação consiste em comparar os dois valores — sem que o código seja transmitido pela rede durante o processo de setup.

| Característica | Detalhe |
|---|---|
| Protocolo | TOTP (RFC 6238) |
| Algoritmo | HMAC-SHA1 |
| Duração do código | 30 segundos |
| Comprimento | 6 dígitos |
| Compatibilidade | Microsoft Authenticator, Google Authenticator, Authy |

---

## Slide 4 — Arquitectura da Implementação

> "Vou agora mostrar como a solução foi arquitectada nas duas camadas da aplicação: backend e frontend."

**No backend** (Node.js + Express + PostgreSQL), foram adicionadas duas colunas à tabela de customers — `mfa_secret` para guardar o segredo TOTP encriptado e `mfa_enabled` como flag de activação. Foram criados cinco endpoints dedicados na rota `/api/mfa`:

- `GET /api/mfa/status` — consulta se o MFA está activo para o customer autenticado
- `POST /api/mfa/setup` — gera um novo segredo TOTP e devolve o QR Code em formato base64
- `POST /api/mfa/verify` — valida o primeiro código inserido pelo utilizador e activa o MFA
- `POST /api/mfa/disable` — desactiva o MFA após confirmação com código válido
- `POST /api/mfa/validate` — valida o código TOTP durante o processo de login

A biblioteca utilizada no backend foi o **speakeasy**, que implementa o protocolo TOTP de forma robusta, com suporte a janela de tolerância de ±1 período (30 segundos) para compensar pequenas dessincronizações de relógio.

**No frontend** (React + TypeScript + Vite), o fluxo foi integrado em dois pontos distintos: nas configurações do utilizador para activação/desactivação, e no ecrã de login para verificação obrigatória quando o MFA está activo.

---

## Slide 5 — Fluxo de Activação (Demo)

> "Vou agora descrever o fluxo que o utilizador segue para activar o MFA pela primeira vez."

**Passo 1 — Aceder às Configurações.** O utilizador clica no avatar no canto superior direito ou no rodapé da sidebar, abrindo o modal de configurações. Na aba "Segurança", encontra o painel de Autenticação de Dois Fatores com o estado actual (Inactivo) e o botão "Activar MFA".

**Passo 2 — Scan do QR Code.** Ao clicar em "Activar MFA", o sistema chama `POST /api/mfa/setup`, que gera um segredo único e devolve um QR Code. O utilizador abre o Microsoft Authenticator, selecciona "Adicionar conta" → "Outra conta (Google, etc.)" e aponta a câmara ao QR Code. O Microsoft Authenticator começa imediatamente a gerar códigos de 6 dígitos.

**Passo 3 — Verificação e Activação.** O utilizador insere o código de 6 dígitos exibido no Microsoft Authenticator no campo de verificação. O sistema valida o código contra o segredo gerado — se for válido, o MFA é activado e o estado muda para "Activo" (badge verde).

---

## Slide 6 — Fluxo de Login com MFA Activo (Demo)

> "Uma vez activado, o login passa a ter dois passos."

**Passo 1 — Credenciais.** O utilizador insere o Customer ID e o Customer Secret normalmente. O sistema autentica as credenciais e, antes de conceder acesso, verifica se o MFA está activo para aquele customer.

**Passo 2 — Verificação TOTP.** Se o MFA estiver activo, o ecrã transita automaticamente para o passo de verificação, exibindo o ícone do escudo e o campo de 6 dígitos. O utilizador abre o Microsoft Authenticator, copia o código actual e insere-o. O sistema valida via `POST /api/mfa/validate` e, apenas após confirmação, concede acesso à aplicação.

> "É importante notar que o código expira a cada 30 segundos. Se o utilizador demorar, basta aguardar o próximo código — o sistema aceita o código actual e o anterior para compensar latências de rede."

---

## Slide 7 — Segurança e Boas Práticas

> "Alguns aspectos de segurança que foram considerados na implementação."

O segredo TOTP é gerado com 160 bits de entropia (base32, 32 caracteres), o que torna inviável qualquer ataque de força bruta. O segredo nunca é transmitido após o setup inicial — o QR Code é gerado em memória e descartado. A validação no login (`/api/mfa/validate`) não requer Bearer token, mas exige o `customerId` correcto, impedindo enumeração de contas. A janela de tolerância de ±1 período (60 segundos no total) foi configurada para equilibrar usabilidade e segurança.

| Aspecto | Implementação |
|---|---|
| Entropia do segredo | 160 bits (base32, 32 chars) |
| Transmissão do segredo | Apenas no setup, via HTTPS |
| Janela de tolerância | ±1 período (±30 segundos) |
| Rate limiting | 60 tentativas/minuto no endpoint de token |
| Desactivação | Requer código TOTP válido |

---

## Slide 8 — Impacto e Próximos Passos

> "Para concluir, o impacto desta implementação e o que pode ser feito a seguir."

Com o MFA activado, mesmo que as credenciais de um customer sejam comprometidas, o atacante não consegue aceder à plataforma sem o dispositivo físico com o Microsoft Authenticator. Isto eleva significativamente o nível de segurança da plataforma sem introduzir fricção excessiva para o utilizador — o processo de login adiciona apenas 5 a 10 segundos ao fluxo normal.

Como próximos passos naturais, poderiam ser considerados: a implementação de códigos de recuperação (backup codes) para situações em que o utilizador perde acesso ao dispositivo, o registo de eventos de autenticação para auditoria, e a possibilidade de tornar o MFA obrigatório a nível de configuração da plataforma.

> "Obrigado pela atenção. Estou disponível para responder a questões."

---

*Documento preparado para apresentação interna — CWO - IOC Manager*
