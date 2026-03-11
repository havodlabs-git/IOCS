/**
 * Serviço de integração com o IOCs Backend.
 *
 * Em desenvolvimento (Vite dev server), as chamadas a /api/* são
 * redirecionadas via proxy para http://localhost:3000.
 *
 * Em produção (Docker), a variável VITE_API_URL define a base URL.
 */

const BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  token?: string,
  adminKey?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (adminKey) {
    headers['x-admin-key'] = adminKey;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message = (data as { error?: string }).error ?? `HTTP ${res.status}`;
    throw new Error(message);
  }

  return data as T;
}

// ---------------------------------------------------------------------------
// Auth / Customer
// ---------------------------------------------------------------------------

export interface TokenResponse {
  token: string;
  tokenType: string;
  expiresIn: string;
}

/**
 * Obtém um JWT para o customer usando customerId + customerSecret.
 */
export async function getCustomerToken(
  customerId: string,
  customerSecret: string,
): Promise<TokenResponse> {
  return request<TokenResponse>('POST', '/api/customer/token/create', {
    customerId,
    customerSecret,
  });
}

/**
 * Valida se um token JWT ainda é válido.
 */
export async function validateToken(token: string): Promise<{ valid: boolean }> {
  return request<{ valid: boolean }>('POST', '/api/customer/token/auth', { token });
}

/**
 * Retorna dados do customer autenticado (nome, id, createdAt).
 */
export async function getCustomerMe(
  token: string,
): Promise<{ customerId: string; name: string; createdAt: string }> {
  return request<{ customerId: string; name: string; createdAt: string }>(
    'GET',
    '/api/customer/me',
    undefined,
    token,
  );
}

// ---------------------------------------------------------------------------
// IOCs
// ---------------------------------------------------------------------------

export interface IocPayload {
  customerId: string;
  type: string;
  value: string;
  severity: string;
  description?: string;
  tags?: string[];
  status?: string;
  source?: string;
}

export interface IocRecord {
  id: string;
  scope: string;
  customerId?: string;
  type: string;
  value: string;
  severity: string;
  description?: string;
  tags?: string[];
  status?: string;
  source?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Adiciona um IOC para um customer específico.
 * Requer JWT Bearer token do customer.
 */
export async function addCustomerIoc(
  payload: IocPayload,
  token: string,
): Promise<{ data: IocRecord }> {
  return request<{ data: IocRecord }>('POST', '/api/IOCS/customer/add', payload, token);
}

/**
 * Lista IOCs de um customer (inclui globais se includeGlobal=true).
 * Requer JWT Bearer token do customer.
 */
export async function listCustomerIocs(
  customerId: string,
  token: string,
  includeGlobal = true,
): Promise<{ customerId: string; includeGlobal: boolean; data: IocRecord[] }> {
  const qs = new URLSearchParams({
    customerId,
    includeGlobal: String(includeGlobal),
  });
  return request<{ customerId: string; includeGlobal: boolean; data: IocRecord[] }>(
    'GET',
    `/api/IOCS/customer/list?${qs}`,
    undefined,
    token,
  );
}

/**
 * Atualiza um IOC do customer (status, severidade, etc.).
 * Requer JWT Bearer token do customer.
 */
export async function updateCustomerIoc(
  customerId: string,
  iocId: string,
  fields: Partial<Omit<IocPayload, 'customerId'>>,
  token: string,
): Promise<{ data: IocRecord }> {
  return request<{ data: IocRecord }>('PUT', '/api/IOCS/customer/update', { customerId, id: iocId, ...fields }, token);
}

/**
 * Remove um IOC do customer.
 * Requer JWT Bearer token do customer.
 */
export async function deleteCustomerIoc(
  customerId: string,
  iocId: string,
  token: string,
): Promise<{ success: boolean }> {
  const qs = new URLSearchParams({ customerId, id: iocId });
  return request<{ success: boolean }>('DELETE', `/api/IOCS/customer/delete?${qs}`, undefined, token);
}

/**
 * Compartilha um IOC CUSTOMER como GLOBAL (cria cópia com scope=GLOBAL).
 * Requer JWT Bearer token do customer dono do IOC.
 */
export async function shareCustomerIoc(
  customerId: string,
  iocId: string,
  token: string,
): Promise<{ data: IocRecord; sharedFrom: string }> {
  return request<{ data: IocRecord; sharedFrom: string }>(
    'POST',
    '/api/IOCS/customer/share',
    { customerId, id: iocId },
    token,
  );
}

/**
 * Adiciona um IOC GLOBAL (requer Admin Key).
 */
export async function addGlobalIoc(
  payload: Omit<IocPayload, 'customerId'>,
  adminKey: string,
): Promise<{ data: IocRecord }> {
  return request<{ data: IocRecord }>('POST', '/api/IOCS/add', payload, undefined, adminKey);
}

/**
 * Lista todos os IOCs GLOBAIS (requer Admin Key).
 */
export async function listGlobalIocs(
  adminKey: string,
): Promise<{ data: IocRecord[] }> {
  return request<{ data: IocRecord[] }>('GET', '/api/IOCS/list', undefined, undefined, adminKey);
}

/**
 * Verifica saúde do backend.
 */
export async function healthCheck(): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>('GET', '/api/health');
}

// ---------------------------------------------------------------------------
// MFA (TOTP — Microsoft Authenticator compatible)
// ---------------------------------------------------------------------------

export async function getMfaStatus(
  token: string,
): Promise<{ mfaEnabled: boolean }> {
  return request<{ mfaEnabled: boolean }>('GET', '/api/mfa/status', undefined, token);
}

export async function setupMfa(
  token: string,
): Promise<{ secret: string; otpauthUrl: string; qrDataUrl: string }> {
  return request<{ secret: string; otpauthUrl: string; qrDataUrl: string }>(
    'POST', '/api/mfa/setup', undefined, token,
  );
}

export async function verifyMfa(
  token: string,
  code: string,
): Promise<{ mfaEnabled: boolean }> {
  return request<{ mfaEnabled: boolean }>('POST', '/api/mfa/verify', { code }, token);
}

export async function disableMfa(
  token: string,
  code: string,
): Promise<{ mfaEnabled: boolean }> {
  return request<{ mfaEnabled: boolean }>('POST', '/api/mfa/disable', { code }, token);
}

export async function validateMfaLogin(
  customerId: string,
  code: string,
): Promise<{ valid: boolean }> {
  return request<{ valid: boolean }>('POST', '/api/mfa/validate', { customerId, code });
}
