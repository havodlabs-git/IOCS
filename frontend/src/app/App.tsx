import { useState, useEffect, useCallback } from 'react';
import { AuthForm } from '@/app/components/AuthForm';
import { Layout } from '@/app/components/Layout';
import { DashboardPage } from '@/app/components/DashboardPage';
import { IocUploader } from '@/app/components/IocUploader';
import { ApiKeyPage } from '@/app/components/ApiKeyPage';
import { IocListPage } from '@/app/components/IocListPage';
import { AdminPanel } from '@/app/components/AdminPanel';
import { listCustomerIocs } from '@/app/services/api';
import type { IocRecord } from '@/app/services/api';
import type { AuthData } from '@/app/components/AuthForm';
import type { PageId } from '@/app/components/Layout';
import { DEFAULT_SETTINGS } from '@/app/components/UserSettingsModal';
import type { UserSettings } from '@/app/components/UserSettingsModal';

const SETTINGS_KEY = 'cwo_user_settings';
const AUTH_KEY = 'cwo_auth_session';
const ADMIN_KEY = 'cwo_admin_session';

// ─── Admin session persistence ────────────────────────────────────────────────

function loadAdminSession(): string | null {
  try {
    return localStorage.getItem(ADMIN_KEY);
  } catch { return null; }
}

function saveAdminSession(key: string | null) {
  try {
    if (key) localStorage.setItem(ADMIN_KEY, key);
    else localStorage.removeItem(ADMIN_KEY);
  } catch { /* ignore */ }
}

// ─── Customer session persistence ─────────────────────────────────────────────

function loadSettings(): UserSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT_SETTINGS };
}

function loadAuth(): AuthData | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const data: AuthData & { exp?: number } = JSON.parse(raw);
    // Verificar se o token ainda é válido (exp em segundos)
    if (data.exp && Date.now() / 1000 > data.exp) {
      localStorage.removeItem(AUTH_KEY);
      return null;
    }
    return data;
  } catch { /* ignore */ }
  return null;
}

function saveAuth(data: AuthData | null) {
  try {
    if (data) {
      // Extrair exp do JWT para saber quando expira
      let exp: number | undefined;
      try {
        const payload = JSON.parse(atob(data.token.split('.')[1]));
        exp = payload.exp;
      } catch { /* ignore */ }
      localStorage.setItem(AUTH_KEY, JSON.stringify({ ...data, exp }));
    } else {
      localStorage.removeItem(AUTH_KEY);
    }
  } catch { /* ignore */ }
}

// ─── Admin detection ──────────────────────────────────────────────────────────
// O login admin é feito com customerId = "admin" e customerSecret = X-Admin-Key.
// O backend não tem conta "admin" na tabela customers, por isso a chamada
// getCustomerToken irá falhar — interceptamos esse caso especial antes de chamar
// a API, verificando se customerId === 'admin' e se o secret parece uma admin key
// (hex de 64 chars). Depois validamos directamente contra /api/IOCS/blueteam/pending
// com o header X-Admin-Key para confirmar que a chave é válida.

async function validateAdminKey(key: string): Promise<boolean> {
  try {
    const res = await fetch('/api/IOCS/blueteam/pending', {
      headers: { 'x-admin-key': key }
    });
    return res.ok;
  } catch { return false; }
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  // Admin mode
  const [adminKey, setAdminKey] = useState<string | null>(loadAdminSession);

  // Customer mode
  const [auth, setAuth] = useState<AuthData | null>(loadAuth);
  const [activePage, setActivePage] = useState<PageId>('dashboard');
  const [iocs, setIocs] = useState<IocRecord[]>([]);
  const [loadingIocs, setLoadingIocs] = useState(false);
  const [settings, setSettings] = useState<UserSettings>(loadSettings);

  // Validate persisted admin key on mount
  useEffect(() => {
    if (adminKey) {
      validateAdminKey(adminKey).then(valid => {
        if (!valid) {
          saveAdminSession(null);
          setAdminKey(null);
        }
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchIocs = useCallback(async (currentAuth: AuthData) => {
    setLoadingIocs(true);
    try {
      const res = await listCustomerIocs(currentAuth.customerId, currentAuth.token, true);
      setIocs(res.data ?? []);
    } catch {
      // silently fail — cada página trata seu próprio erro
    } finally {
      setLoadingIocs(false);
    }
  }, []);

  useEffect(() => {
    if (auth) fetchIocs(auth);
  }, [auth, fetchIocs]);

  // Called by AuthForm — intercept admin login before API call
  const handleAuthentication = async (data: AuthData) => {
    if (data.customerId.toLowerCase() === 'admin') {
      // Admin login: customerSecret is the X-Admin-Key
      const key = data.customerSecret.trim();
      const valid = await validateAdminKey(key);
      if (valid) {
        saveAdminSession(key);
        setAdminKey(key);
      } else {
        // Let AuthForm show the error naturally — throw so AuthForm catches it
        throw new Error('INVALID_CUSTOMER_SECRET');
      }
      return;
    }
    saveAuth(data);
    setAuth(data);
    setActivePage('dashboard');
  };

  const handleLogout = () => {
    saveAuth(null);
    setAuth(null);
    setIocs([]);
    setActivePage('dashboard');
  };

  const handleAdminLogout = () => {
    saveAdminSession(null);
    setAdminKey(null);
  };

  const handleRefresh = () => {
    if (auth) fetchIocs(auth);
  };

  const handleUpdateSettings = (newSettings: UserSettings) => {
    setSettings(newSettings);
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
    } catch { /* ignore */ }
  };

  // ── Admin mode ──
  if (adminKey) {
    return <AdminPanel adminKey={adminKey} onLogout={handleAdminLogout} />;
  }

  // ── Not authenticated ──
  if (!auth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
        <AuthForm onAuthenticate={handleAuthentication} />
      </div>
    );
  }

  // ── Customer portal ──
  return (
    <Layout
      auth={auth}
      onLogout={handleLogout}
      activePage={activePage}
      onNavigate={setActivePage}
      settings={settings}
      onUpdateSettings={handleUpdateSettings}
    >
      {activePage === 'dashboard' && (
        <DashboardPage
          iocs={iocs}
          loading={loadingIocs}
          onRefresh={handleRefresh}
          customerName={auth.customerName}
        />
      )}
      {activePage === 'upload' && (
        <IocUploader
          auth={auth}
          onUploadSuccess={handleRefresh}
        />
      )}
      {activePage === 'iocs' && (
        <IocListPage
          iocs={iocs}
          loading={loadingIocs}
          onRefresh={handleRefresh}
          auth={auth}
          settings={settings}
        />
      )}
      {activePage === 'apikey' && (
        <ApiKeyPage auth={auth} />
      )}
    </Layout>
  );
}
