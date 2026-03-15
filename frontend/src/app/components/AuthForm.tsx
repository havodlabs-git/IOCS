import { useState, useRef, useEffect } from 'react';
import { Key, Shield, AlertTriangle, Loader2, ArrowLeft } from 'lucide-react';
import logo from '@/assets/logo-dark.png';
import { getCustomerToken, getCustomerMe, getMfaStatus, validateMfaLogin } from '@/app/services/api';

export interface AuthData {
  customerId: string;
  customerSecret: string;
  customerName: string;
  token: string;
}

interface AuthFormProps {
  onAuthenticate: (data: AuthData) => void;
}

type Step = 'credentials' | 'mfa';

export function AuthForm({ onAuthenticate }: AuthFormProps) {
  const [step, setStep] = useState<Step>('credentials');

  // Credentials step
  const [customerId, setCustomerId] = useState('');
  const [customerSecret, setCustomerSecret] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // MFA step — stored pending auth data
  const [pendingAuth, setPendingAuth] = useState<AuthData | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaError, setMfaError] = useState('');
  const [mfaLoading, setMfaLoading] = useState(false);
  const mfaInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 'mfa' && mfaInputRef.current) {
      mfaInputRef.current.focus();
    }
  }, [step]);

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!customerId.trim()) { setError('Por favor, insira o Customer ID'); return; }
    if (!customerSecret.trim()) { setError('Por favor, insira o Customer Secret'); return; }

    setLoading(true);
    try {
      const res = await getCustomerToken(customerId.trim(), customerSecret.trim());

      let customerName = customerId.trim();
      try {
        const me = await getCustomerMe(res.token);
        customerName = me.name || customerId.trim();
      } catch { /* fallback */ }

      const authData: AuthData = {
        customerId: customerId.trim(),
        customerSecret: customerSecret.trim(),
        customerName,
        token: res.token,
      };

      // Check if MFA is enabled for this customer
      let mfaEnabled = false;
      try {
        const mfaStatus = await getMfaStatus(res.token);
        mfaEnabled = mfaStatus.mfaEnabled;
      } catch { /* MFA not configured */ }

      if (mfaEnabled) {
        setPendingAuth(authData);
        setMfaCode('');
        setMfaError('');
        setStep('mfa');
      } else {
        onAuthenticate(authData);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      if (msg === 'INVALID_CUSTOMER_SECRET') setError('Customer Secret inválido.');
      else if (msg === 'CUSTOMER_NOT_FOUND') setError('Customer ID não encontrado.');
      else setError(`Falha na autenticação: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingAuth) return;
    const clean = mfaCode.replace(/\s/g, '');
    if (clean.length !== 6) { setMfaError('Introduza o código de 6 dígitos.'); return; }

    setMfaLoading(true);
    setMfaError('');
    try {
      await validateMfaLogin(pendingAuth.customerId, clean);
      onAuthenticate(pendingAuth);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro';
      if (msg === 'INVALID_MFA_CODE') setMfaError('Código inválido. Tente novamente.');
      else setMfaError(`Erro: ${msg}`);
    } finally {
      setMfaLoading(false);
    }
  };

  const handleMfaCodeChange = (val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 6);
    setMfaCode(clean);
    setMfaError('');
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">

          {/* Logo */}
          <div className="flex justify-center mb-6">
            <img src={logo} alt="MEO" className="h-12 w-auto" />
          </div>

          {/* ── STEP 1: Credentials ── */}
          {step === 'credentials' && (
            <>
              <h1 className="text-center mb-2">CWO - IOC Manager</h1>
              <p className="text-center text-slate-600 mb-8">
                Insira suas credenciais de customer para continuar
              </p>
              <form onSubmit={handleCredentials} className="space-y-5">
                <div>
                  <label htmlFor="customerId" className="block mb-2 text-slate-700">Customer ID</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Key className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      type="text"
                      id="customerId"
                      value={customerId}
                      onChange={(e) => { setCustomerId(e.target.value); setError(''); }}
                      placeholder="UUID do customer"
                      className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                      autoComplete="username"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="customerSecret" className="block mb-2 text-slate-700">Customer Secret</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Key className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      type="password"
                      id="customerSecret"
                      value={customerSecret}
                      onChange={(e) => { setCustomerSecret(e.target.value); setError(''); }}
                      placeholder="Secret gerado no registro"
                      className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      autoComplete="current-password"
                    />
                  </div>
                  {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white py-3 rounded-lg transition-colors duration-200 shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                >
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" />A autenticar…</> : 'Autenticar'}
                </button>
              </form>

            </>
          )}

          {/* ── STEP 2: MFA ── */}
          {step === 'mfa' && (
            <>
              <div className="flex flex-col items-center mb-6 gap-3">
                <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center">
                  <Shield className="w-7 h-7 text-blue-600" />
                </div>
                <div className="text-center">
                  <h2 className="text-lg font-semibold text-slate-800">Verificação em dois passos</h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Introduza o código do <strong>Microsoft Authenticator</strong>
                  </p>
                </div>
              </div>

              <form onSubmit={handleMfa} className="space-y-5">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700 text-center">
                    Código de 6 dígitos
                  </label>
                  <input
                    ref={mfaInputRef}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={mfaCode}
                    onChange={(e) => handleMfaCodeChange(e.target.value)}
                    placeholder="000000"
                    className="w-full text-center text-3xl font-mono tracking-[0.6em] px-4 py-4 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 transition-colors"
                  />
                  {mfaError && (
                    <div className="flex items-center justify-center gap-2 text-red-600 text-sm">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      {mfaError}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={mfaLoading || mfaCode.length !== 6}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white py-3 rounded-lg transition-colors duration-200 shadow-lg flex items-center justify-center gap-2"
                >
                  {mfaLoading ? <><Loader2 className="w-4 h-4 animate-spin" />A verificar…</> : 'Verificar e entrar'}
                </button>

                <button
                  type="button"
                  onClick={() => { setStep('credentials'); setPendingAuth(null); setMfaCode(''); setMfaError(''); }}
                  className="w-full flex items-center justify-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors py-2"
                >
                  <ArrowLeft className="w-4 h-4" />Voltar ao login
                </button>
              </form>

              <div className="mt-4 p-3 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500 text-center">
                  O código renova a cada 30 segundos. Certifique-se de que o relógio do dispositivo está sincronizado.
                </p>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
