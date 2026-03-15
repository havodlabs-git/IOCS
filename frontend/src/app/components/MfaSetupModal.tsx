import { useState, useEffect, useRef } from 'react';
import { X, Shield, CheckCircle, Copy, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { setupMfa, verifyMfa, disableMfa } from '@/app/services/api';

interface MfaSetupModalProps {
  token: string;
  mfaEnabled: boolean;
  onClose: () => void;
  onStatusChange: (enabled: boolean) => void;
}

type Step = 'loading' | 'qr' | 'verify' | 'success' | 'disable' | 'disabled' | 'error';

export function MfaSetupModal({ token, mfaEnabled, onClose, onStatusChange }: MfaSetupModalProps) {
  const [step, setStep] = useState<Step>(mfaEnabled ? 'disable' : 'loading');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 'loading') {
      setError('');
      setupMfa(token)
        .then((res) => {
          if (!res.qrDataUrl || !res.secret) {
            setError('O servidor não devolveu o QR code. Tente novamente.');
            setStep('error');
            return;
          }
          setQrDataUrl(res.qrDataUrl);
          setSecret(res.secret);
          setStep('qr');
        })
        .catch((e) => {
          const msg = e instanceof Error ? e.message : String(e);
          if (msg === 'MFA_ALREADY_ENABLED') {
            // MFA já activo — fechar e informar
            setError('O MFA já está activo nesta conta.');
            setStep('error');
          } else {
            setError(msg || 'Erro ao gerar o QR code. Verifique a ligação e tente novamente.');
            setStep('error');
          }
        });
    }
  }, [step, token]);

  useEffect(() => {
    if ((step === 'verify' || step === 'disable') && inputRef.current) {
      inputRef.current.focus();
    }
  }, [step]);

  const handleCopySecret = () => {
    navigator.clipboard.writeText(secret).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleVerify = async () => {
    if (code.replace(/\s/g, '').length !== 6) {
      setError('Introduza o código de 6 dígitos.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await verifyMfa(token, code);
      onStatusChange(true);
      setStep('success');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg === 'INVALID_MFA_CODE' ? 'Código inválido. Tente novamente.' : msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async () => {
    if (code.replace(/\s/g, '').length !== 6) {
      setError('Introduza o código de 6 dígitos.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await disableMfa(token, code);
      onStatusChange(false);
      setStep('disabled');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg === 'INVALID_MFA_CODE' ? 'Código inválido. Tente novamente.' : msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 6);
    setCode(clean);
    setError('');
  };

  const handleRetry = () => {
    setQrDataUrl('');
    setSecret('');
    setError('');
    setCode('');
    setStep('loading');
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md z-10 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-900 to-slate-800 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Autenticação de Dois Fatores</p>
              <p className="text-xs text-slate-400">Microsoft Authenticator (TOTP)</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6">

          {/* LOADING */}
          {step === 'loading' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              <p className="text-sm text-slate-500">A gerar o código QR…</p>
            </div>
          )}

          {/* ERROR */}
          {step === 'error' && (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-9 h-9 text-red-500" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-800">Erro ao configurar MFA</h3>
                <p className="text-xs text-slate-500 mt-1">{error}</p>
              </div>
              <div className="flex gap-3 w-full">
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Fechar
                </button>
                <button
                  onClick={handleRetry}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />Tentar novamente
                </button>
              </div>
            </div>
          )}

          {/* QR CODE */}
          {step === 'qr' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-base font-semibold text-slate-800">Passo 1 — Leia o código QR</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Abra o <strong>Microsoft Authenticator</strong>, toque em <em>"Adicionar conta"</em> → <em>"Outra conta"</em> e aponte a câmara para o QR abaixo.
                </p>
              </div>

              {qrDataUrl ? (
                <div className="flex justify-center">
                  <div className="p-3 bg-white border-2 border-slate-200 rounded-xl shadow-sm">
                    <img src={qrDataUrl} alt="QR Code MFA" className="w-48 h-48" />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="w-48 h-48 bg-slate-100 rounded-xl flex items-center justify-center border-2 border-dashed border-slate-300">
                    <div className="text-center">
                      <Loader2 className="w-8 h-8 text-slate-400 animate-spin mx-auto mb-2" />
                      <p className="text-xs text-slate-400">A carregar QR code…</p>
                    </div>
                  </div>
                </div>
              )}

              {secret && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-slate-600">Chave manual (se não conseguir ler o QR):</p>
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                    <code className="flex-1 text-xs font-mono text-slate-700 tracking-widest break-all">{secret}</code>
                    <button onClick={handleCopySecret} className="text-slate-400 hover:text-blue-600 transition-colors flex-shrink-0">
                      {copied ? <CheckCircle className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              <button
                onClick={() => { setCode(''); setError(''); setStep('verify'); }}
                disabled={!qrDataUrl && !secret}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Já adicionei — Verificar código →
              </button>
            </div>
          )}

          {/* VERIFY */}
          {step === 'verify' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-base font-semibold text-slate-800">Passo 2 — Confirme o código</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Introduza o código de <strong>6 dígitos</strong> que aparece no Microsoft Authenticator para confirmar a configuração.
                </p>
              </div>

              <div className="space-y-2">
                <input
                  ref={inputRef}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={code}
                  onChange={(e) => handleCodeChange(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                  placeholder="000000"
                  className="w-full text-center text-2xl font-mono tracking-[0.5em] px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 transition-colors"
                />
                {error && (
                  <div className="flex items-center gap-2 text-red-600 text-xs">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    {error}
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => { setCode(''); setError(''); setStep('qr'); }}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
                >
                  ← Voltar
                </button>
                <button
                  onClick={handleVerify}
                  disabled={loading || code.length !== 6}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Activar MFA
                </button>
              </div>
            </div>
          )}

          {/* SUCCESS */}
          {step === 'success' && (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-9 h-9 text-green-600" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-800">MFA Activado!</h3>
                <p className="text-xs text-slate-500 mt-1">
                  A partir do próximo login, será solicitado o código do Microsoft Authenticator.
                </p>
              </div>
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 text-left">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-600 mt-0.5" />
                <span>Guarde a chave manual em local seguro. Sem ela, não poderá recuperar o acesso se perder o dispositivo.</span>
              </div>
              <button
                onClick={onClose}
                className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Concluir
              </button>
            </div>
          )}

          {/* DISABLE */}
          {step === 'disable' && (
            <div className="space-y-5">
              <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-800">Desactivar MFA</p>
                  <p className="text-xs text-red-700 mt-0.5">
                    Introduza o código actual do Microsoft Authenticator para confirmar a desactivação.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <input
                  ref={inputRef}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={code}
                  onChange={(e) => handleCodeChange(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleDisable()}
                  placeholder="000000"
                  className="w-full text-center text-2xl font-mono tracking-[0.5em] px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-red-400 transition-colors"
                />
                {error && (
                  <div className="flex items-center gap-2 text-red-600 text-xs">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    {error}
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors">
                  Cancelar
                </button>
                <button
                  onClick={handleDisable}
                  disabled={loading || code.length !== 6}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Desactivar
                </button>
              </div>
            </div>
          )}

          {/* DISABLED */}
          {step === 'disabled' && (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
                <Shield className="w-9 h-9 text-slate-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-800">MFA Desactivado</h3>
                <p className="text-xs text-slate-500 mt-1">
                  O login voltará a ser feito apenas com Customer ID e Secret.
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-full py-2.5 bg-slate-700 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Fechar
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
