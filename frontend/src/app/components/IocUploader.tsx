import { useState } from 'react';
import {
  Upload,
  FileText,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  Shield,
} from 'lucide-react';
import { addCustomerIoc } from '@/app/services/api';
import type { AuthData } from './AuthForm';

export interface IocData {
  id: string;
  type: string;
  value: string;
  severity: number;  // 0-10 conforme exigido pelo backend
  description?: string;
  tags?: string[];
  status?: string;
  source?: string;
}

interface IocUploaderProps {
  auth: AuthData;
  onUploadSuccess?: () => void;
}

// ---------------------------------------------------------------------------
// Detecção de tipo
// ---------------------------------------------------------------------------

function detectIocType(value: string): string {
  const v = value.trim();
  if (/^\d{1,3}(\.\d{1,3}){3}(\/\d+)?$/.test(v)) return 'ip';
  if (/^[0-9a-fA-F:]+:[0-9a-fA-F:]+$/.test(v)) return 'ipv6';
  if (/^[a-fA-F0-9]{32}$/.test(v)) return 'md5';
  if (/^[a-fA-F0-9]{40}$/.test(v)) return 'sha1';
  if (/^[a-fA-F0-9]{64}$/.test(v)) return 'sha256';
  if (/^https?:\/\//i.test(v)) return 'url';
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'email';
  if (/^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/.test(v)) return 'domain';
  return 'unknown';
}

// ---------------------------------------------------------------------------
// Normalização de severidade: string → número 0-10
// ---------------------------------------------------------------------------

const SEVERITY_MAP: Record<string, number> = {
  info: 1, low: 2, medium: 5, med: 5, high: 8, critical: 10, crit: 10,
};

function normalizeSeverity(raw: string | number | undefined | null): number {
  if (raw === undefined || raw === null || raw === '') return 5;
  const n = Number(raw);
  if (Number.isFinite(n) && n >= 0 && n <= 10) return Math.trunc(n);
  return SEVERITY_MAP[String(raw).trim().toLowerCase()] ?? 5;
}

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

function parseTXT(text: string): IocData[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((value, idx) => ({
      id: String(idx + 1),
      type: detectIocType(value),
      value,
      severity: 5,
      description: '',
      tags: [],
      status: 'active',
      source: '',
    }));
}

function parseCSV(text: string): IocData[] {
  const lines = text.split('\n').filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  return lines
    .slice(1)
    .map((line, idx) => {
      const values = line.split(',').map((v) => v.trim());
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => { obj[h] = values[i] ?? ''; });
      const value = obj['value'] || obj['ioc'] || '';
      return {
        id: String(idx + 1),
        type: obj['type'] || detectIocType(value),
        value,
        severity: normalizeSeverity(obj['severity']),
        description: obj['description'] || obj['desc'] || '',
        tags: obj['tags'] ? obj['tags'].split(';').map((t) => t.trim()) : [],
        status: obj['status'] || 'active',
        source: obj['source'] || '',
      };
    })
    .filter((ioc) => ioc.value);
}

function parseJSON(text: string): IocData[] {
  const data = JSON.parse(text);
  const arr = Array.isArray(data) ? data : data.iocs ?? data.data ?? [];
  return (arr as Record<string, unknown>[])
    .map((item, idx) => {
      const value = String(item.value ?? item.ioc ?? '');
      return {
        id: String(item.id ?? idx + 1),
        type: String(item.type ?? detectIocType(value)),
        value,
        severity: normalizeSeverity(item.severity as string | number | undefined),
        description: String(item.description ?? item.desc ?? ''),
        tags: Array.isArray(item.tags) ? (item.tags as unknown[]).map(String) : [],
        status: String(item.status ?? 'active'),
        source: String(item.source ?? ''),
      };
    })
    .filter((ioc) => ioc.value);
}

function parseFile(text: string, filename: string): IocData[] {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.json')) return parseJSON(text);
  if (lower.endsWith('.csv')) return parseCSV(text);
  const txtResult = parseTXT(text);
  if (txtResult.length > 0) return txtResult;
  return parseCSV(text);
}

// ---------------------------------------------------------------------------
// Severity display helpers
// ---------------------------------------------------------------------------

function severityLabel(n: number): string {
  if (n >= 9) return `Critical (${n})`;
  if (n >= 7) return `High (${n})`;
  if (n >= 4) return `Medium (${n})`;
  if (n >= 1) return `Low (${n})`;
  return `Info (${n})`;
}

function severityColor(n: number): string {
  if (n >= 9) return 'bg-red-100 text-red-800 border-red-300';
  if (n >= 7) return 'bg-orange-100 text-orange-800 border-orange-300';
  if (n >= 4) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
  if (n >= 1) return 'bg-blue-100 text-blue-800 border-blue-300';
  return 'bg-slate-100 text-slate-600 border-slate-200';
}

function severityIcon(n: number) {
  if (n >= 7) return <AlertTriangle className="w-3 h-3" />;
  return <Shield className="w-3 h-3" />;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function IocUploader({ auth, onUploadSuccess }: IocUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [iocs, setIocs] = useState<IocData[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState<{ sent: number; failed: number } | null>(null);

  const handleFileChange = async (selectedFile: File | null) => {
    if (!selectedFile) return;
    setFile(selectedFile);
    setError('');
    setSuccess('');
    setIocs([]);
    setUploadResults(null);

    try {
      const text = await selectedFile.text();
      const parsedIocs = parseFile(text, selectedFile.name);
      if (parsedIocs.length === 0) {
        setError('Nenhum IOC válido encontrado no arquivo.');
        return;
      }
      setIocs(parsedIocs);
      setSuccess(`${parsedIocs.length} IOC(s) carregado(s) — pronto para enviar.`);
    } catch {
      setError('Erro ao processar o arquivo. Verifique o formato.');
      setFile(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFileChange(f);
  };

  const handleUpload = async () => {
    if (iocs.length === 0) { setError('Nenhum IOC para enviar.'); return; }
    setUploading(true);
    setError('');
    setSuccess('');
    setUploadResults(null);

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const ioc of iocs) {
      try {
        await addCustomerIoc(
          { customerId: auth.customerId, type: ioc.type, value: ioc.value, severity: ioc.severity, description: ioc.description, tags: ioc.tags, status: ioc.status, source: ioc.source },
          auth.token,
        );
        sent++;
      } catch (err: unknown) {
        failed++;
        errors.push(`[${ioc.value}] ${err instanceof Error ? err.message : 'Erro'}`);
      }
    }

    setUploadResults({ sent, failed });
    setUploading(false);

    if (failed === 0) {
      setSuccess(`${sent} IOC(s) enviado(s) com sucesso!`);
      setIocs([]);
      setFile(null);
      onUploadSuccess?.();
    } else {
      setError(
        `${sent} enviado(s), ${failed} falhou/falharam. ${errors.slice(0, 3).join(' | ')}${errors.length > 3 ? ` (+${errors.length - 3})` : ''}`,
      );
      if (sent > 0) onUploadSuccess?.();
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Upload de IOCs</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Envie um arquivo CSV, JSON ou TXT com seus indicadores de comprometimento.
        </p>
      </div>

      {/* Drop zone */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors ${
            isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
          }`}
        >
          <div className="flex flex-col items-center gap-4">
            <div className={`p-4 rounded-full ${isDragging ? 'bg-blue-100' : 'bg-slate-100'}`}>
              <Upload className={`w-8 h-8 ${isDragging ? 'text-blue-600' : 'text-slate-500'}`} />
            </div>
            <div>
              <p className="text-slate-700 mb-3">Arraste e solte seu arquivo aqui ou</p>
              <label className="inline-block px-5 py-2.5 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm">
                Selecionar Arquivo
                <input
                  type="file"
                  accept=".csv,.json,.txt"
                  onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>
            </div>
            <p className="text-xs text-slate-400">
              Formatos: <strong>CSV</strong>, <strong>JSON</strong>, <strong>TXT</strong> (um IOC por linha)
            </p>
          </div>
        </div>

        {file && (
          <div className="mt-4 p-3 bg-slate-50 rounded-lg flex items-center gap-3 border border-slate-200">
            <FileText className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <span className="flex-1 text-slate-700 text-sm font-medium">{file.name}</span>
            <span className="text-xs text-slate-400">{(file.size / 1024).toFixed(2)} KB</span>
          </div>
        )}

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {success && !uploading && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-green-700 text-sm">{success}</p>
          </div>
        )}

        {uploadResults && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
            Resultado: <strong>{uploadResults.sent}</strong> enviado(s), <strong>{uploadResults.failed}</strong> falhou/falharam.
          </div>
        )}

        {iocs.length > 0 && (
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="mt-4 w-full bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed text-white py-3 rounded-lg transition-colors shadow-sm font-medium"
          >
            {uploading
              ? `Enviando... (${iocs.length} IOCs)`
              : `Enviar ${iocs.length} IOC(s) para a Plataforma`}
          </button>
        )}
      </div>

      {/* Preview */}
      {iocs.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">
              Pré-visualização — {iocs.length} IOC(s)
            </h3>
            <span className="text-xs text-slate-400">Revise antes de enviar</span>
          </div>
          <div className="overflow-auto max-h-[360px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                <tr>
                  {['#', 'Tipo', 'Valor', 'Severidade', 'Status', 'Descrição'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {iocs.map((ioc, idx) => (
                  <tr key={ioc.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                    <td className="px-4 py-2.5 text-xs text-slate-400">{idx + 1}</td>
                    <td className="px-4 py-2.5">
                      <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700 border border-slate-200">
                        {ioc.type}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 max-w-[240px]">
                      <code className="text-xs text-slate-900 bg-slate-100 px-2 py-0.5 rounded font-mono break-all">
                        {ioc.value}
                      </code>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${severityColor(ioc.severity)}`}>
                        {severityIcon(ioc.severity)}
                        {severityLabel(ioc.severity)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${ioc.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                        {ioc.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500 max-w-[180px] truncate">
                      {ioc.description || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Format guide */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Guia de Formatos</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="font-semibold text-slate-700 mb-1">TXT</p>
            <pre className="text-slate-500 leading-relaxed">{`# Um IOC por linha
192.168.1.100
evil.com
http://bad.xyz`}</pre>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="font-semibold text-slate-700 mb-1">CSV</p>
            <pre className="text-slate-500 leading-relaxed">{`type,value,severity
ip,1.2.3.4,high
domain,bad.com,8`}</pre>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="font-semibold text-slate-700 mb-1">JSON</p>
            <pre className="text-slate-500 leading-relaxed">{`[{
  "type": "ip",
  "value": "1.2.3.4",
  "severity": 8
}]`}</pre>
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-3">
          Severidade: número <strong>0–10</strong> ou texto (<strong>low</strong>, <strong>medium</strong>, <strong>high</strong>, <strong>critical</strong>)
        </p>
      </div>
    </div>
  );
}
