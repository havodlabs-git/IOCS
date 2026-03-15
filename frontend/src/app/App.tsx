import { useState, useEffect, useCallback } from 'react';
import { AuthForm } from '@/app/components/AuthForm';
import { Layout } from '@/app/components/Layout';
import { DashboardPage } from '@/app/components/DashboardPage';
import { IocUploader } from '@/app/components/IocUploader';
import { ApiKeyPage } from '@/app/components/ApiKeyPage';
import { IocListPage } from '@/app/components/IocListPage';
import { listCustomerIocs } from '@/app/services/api';
import type { IocRecord } from '@/app/services/api';
import type { AuthData } from '@/app/components/AuthForm';
import type { PageId } from '@/app/components/Layout';
import { DEFAULT_SETTINGS } from '@/app/components/UserSettingsModal';
import type { UserSettings } from '@/app/components/UserSettingsModal';

const SETTINGS_KEY = 'cwo_user_settings';

function loadSettings(): UserSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT_SETTINGS };
}

export default function App() {
  const [auth, setAuth] = useState<AuthData | null>(null);
  const [activePage, setActivePage] = useState<PageId>('dashboard');
  const [iocs, setIocs] = useState<IocRecord[]>([]);
  const [loadingIocs, setLoadingIocs] = useState(false);
  const [settings, setSettings] = useState<UserSettings>(loadSettings);

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

  const handleAuthentication = (data: AuthData) => {
    setAuth(data);
    setActivePage('dashboard');
  };

  const handleLogout = () => {
    setAuth(null);
    setIocs([]);
    setActivePage('dashboard');
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

  if (!auth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
        <AuthForm onAuthenticate={handleAuthentication} />
      </div>
    );
  }

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
