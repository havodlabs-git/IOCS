import { useState } from 'react';
import {
  Key,
  Copy,
  Eye,
  EyeOff,
  CheckCircle,
  Shield,
  Info,
  Code,
  Terminal,
} from 'lucide-react';
import type { AuthData } from './AuthForm';

interface ApiKeyPageProps {
  auth: AuthData;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700 transition-colors"
    >
      {copied ? (
        <><CheckCircle className="w-3.5 h-3.5 text-green-400" /><span className="text-green-400">Copiado!</span></>
      ) : (
        <><Copy className="w-3.5 h-3.5" />Copiar</>
      )}
    </button>
  );
}

function CopyButtonLight({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
    >
      {copied ? (
        <><CheckCircle className="w-3.5 h-3.5 text-green-600" /><span className="text-green-600">Copiado!</span></>
      ) : (
        <><Copy className="w-3.5 h-3.5" />Copiar</>
      )}
    </button>
  );
}

// Campo com eye toggle — usado apenas para o Customer ID
function SecretFieldWithEye({ value, label }: { value: string; label: string }) {
  const [visible, setVisible] = useState(false);
  const masked = '•'.repeat(Math.min(value.length, 36));
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</label>
      <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
        <code className="flex-1 text-sm font-mono text-slate-800 break-all">
          {visible ? value : masked}
        </code>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => setVisible((v) => !v)}
            className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
            title={visible ? 'Ocultar' : 'Mostrar'}
          >
            {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          <CopyButtonLight text={value} />
        </div>
      </div>
    </div>
  );
}

// Campo apenas com botão copiar — usado para o Customer Secret (sem eye)
function SecretFieldCopyOnly({ value, label }: { value: string; label: string }) {
  const masked = '•'.repeat(Math.min(value.length, 36));
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</label>
      <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
        <code className="flex-1 text-sm font-mono text-slate-800 break-all">
          {masked}
        </code>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <CopyButtonLight text={value} />
        </div>
      </div>
    </div>
  );
}

function CodeBlock({ code, language = 'bash' }: { code: string; language?: string }) {
  return (
    <div className="rounded-lg overflow-hidden border border-slate-700">
      <div className="flex items-center justify-between bg-slate-800 px-3 py-1.5">
        <span className="text-xs text-slate-400 font-mono">{language}</span>
        <CopyButton text={code} />
      </div>
      <pre className="bg-slate-900 text-slate-100 text-xs font-mono p-3 overflow-x-auto leading-relaxed whitespace-pre-wrap break-words">
        {code}
      </pre>
    </div>
  );
}

export function ApiKeyPage({ auth }: ApiKeyPageProps) {
  const baseUrl = window.location.origin;

  const curlAuth = `curl -X POST ${baseUrl}/api/customer/token/create \\
  -H "Content-Type: application/json" \\
  -d '{
    "customerId": "${auth.customerId}",
    "customerSecret": "<SEU_SECRET>"
  }'`;

  const curlAdd = `curl -X POST ${baseUrl}/api/IOCS/customer/add \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <TOKEN>" \\
  -d '{
    "customerId": "${auth.customerId}",
    "type": "ip",
    "value": "192.168.1.100",
    "severity": 8,
    "tags": ["malware"],
    "status": "active"
  }'`;

  const curlList = `curl -G ${baseUrl}/api/IOCS/customer/list \\
  -H "Authorization: Bearer <TOKEN>" \\
  --data-urlencode "customerId=${auth.customerId}"`;

  const curlUpdate = `curl -X PUT ${baseUrl}/api/IOCS/customer/update \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <TOKEN>" \\
  -d '{
    "customerId": "${auth.customerId}",
    "id": "<IOC_ID>",
    "severity": 10,
    "status": "inactive"
  }'`;

  const curlDelete = `curl -X DELETE \\
  "${baseUrl}/api/IOCS/customer/delete?customerId=${auth.customerId}&id=<IOC_ID>" \\
  -H "Authorization: Bearer <TOKEN>"`;

  const curlShare = `curl -X POST ${baseUrl}/api/IOCS/customer/share \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <TOKEN>" \\
  -d '{
    "customerId": "${auth.customerId}",
    "id": "<IOC_ID>"
  }'`;

  const jsExample = `const { token } = await fetch('/api/customer/token/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    customerId: '${auth.customerId}',
    customerSecret: '<SEU_SECRET>',
  }),
}).then(r => r.json());

const h = {
  'Content-Type': 'application/json',
  Authorization: \`Bearer \${token}\`,
};

// Adicionar IOC
await fetch('/api/IOCS/customer/add', {
  method: 'POST', headers: h,
  body: JSON.stringify({
    customerId: '${auth.customerId}',
    type: 'ip', value: '1.2.3.4', severity: 8,
  }),
});

// Listar IOCs
const { data } = await fetch(
  '/api/IOCS/customer/list?customerId=${auth.customerId}',
  { headers: h }
).then(r => r.json());`;

  const endpoints = [
    { method: 'POST',   path: '/api/customer/token/create', desc: 'Obter token',    auth: 'Secret' },
    { method: 'POST',   path: '/api/IOCS/customer/add',     desc: 'Adicionar IOC',  auth: 'Bearer' },
    { method: 'GET',    path: '/api/IOCS/customer/list',    desc: 'Consultar IOCs', auth: 'Bearer' },
    { method: 'PUT',    path: '/api/IOCS/customer/update',  desc: 'Atualizar IOC',  auth: 'Bearer' },
    { method: 'DELETE', path: '/api/IOCS/customer/delete',  desc: 'Remover IOC',    auth: 'Bearer' },
    { method: 'POST',   path: '/api/IOCS/customer/share',   desc: 'Compartilhar',   auth: 'Bearer' },
  ];

  const examples = [
    { label: '1. Autenticar',         code: curlAuth,   lang: 'bash' },
    { label: '2. Adicionar IOC',      code: curlAdd,    lang: 'bash' },
    { label: '3. Consultar IOCs',     code: curlList,   lang: 'bash' },
    { label: '4. Atualizar IOC',      code: curlUpdate, lang: 'bash' },
    { label: '5. Remover IOC',        code: curlDelete, lang: 'bash' },
    { label: '6. Compartilhar IOC',   code: curlShare,  lang: 'bash' },
    { label: '7. JavaScript (completo)', code: jsExample, lang: 'javascript' },
  ];

  const [activeExample, setActiveExample] = useState(0);

  return (
    <div className="space-y-4 h-full">

      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-5 text-white">
        <div className="flex items-center gap-3 mb-1">
          <div className="bg-white/20 p-2 rounded-lg">
            <Key className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-bold">Credenciais de API</h2>
        </div>
        <p className="text-blue-100 text-sm">
          Use estas credenciais para integrar a sua aplicação com o CWO - IOC Manager.
        </p>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">

        {/* LEFT COLUMN — Credenciais + Tabela */}
        <div className="space-y-4">

          {/* Warning */}
          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <Shield className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800">
              <p className="font-semibold">Mantenha suas credenciais seguras</p>
              <p className="mt-0.5 text-amber-700">
                Nunca exponha o <strong>Customer Secret</strong> em código client-side ou repositórios públicos.
              </p>
            </div>
          </div>

          {/* Credentials */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Key className="w-4 h-4 text-slate-400" />Suas Credenciais
            </h3>
            <SecretFieldWithEye value={auth.customerId}     label="Customer ID" />
            <SecretFieldCopyOnly value={auth.customerSecret} label="Customer Secret" />
          </div>

          {/* API Reference table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 space-y-3">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-slate-400" />Referência da API
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-2 px-2 text-slate-500 font-semibold">Método</th>
                    <th className="text-left py-2 px-2 text-slate-500 font-semibold">Descrição</th>
                    <th className="text-left py-2 px-2 text-slate-500 font-semibold">Auth</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {endpoints.map((row) => (
                    <tr key={row.path} className="hover:bg-slate-50">
                      <td className="py-2 px-2">
                        <span className={`px-1.5 py-0.5 rounded font-mono font-bold text-xs ${
                          row.method === 'GET'    ? 'bg-green-100 text-green-700' :
                          row.method === 'POST'   ? 'bg-blue-100 text-blue-700' :
                          row.method === 'PUT'    ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>{row.method}</span>
                      </td>
                      <td className="py-2 px-2 text-slate-600">{row.desc}</td>
                      <td className="py-2 px-2">
                        <span className={`px-1.5 py-0.5 rounded text-xs ${
                          row.auth === 'Bearer' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'
                        }`}>{row.auth}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN — Exemplos de código com tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex flex-col" style={{ minHeight: '520px' }}>
          <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
            <Code className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-700">Exemplos de Uso</h3>
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap gap-1 px-4 pt-3 pb-2 border-b border-slate-100 bg-slate-50">
            {examples.map((ex, i) => (
              <button
                key={ex.label}
                onClick={() => setActiveExample(i)}
                className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors whitespace-nowrap ${
                  activeExample === i
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                {ex.label}
              </button>
            ))}
          </div>

          {/* Code panel */}
          <div className="flex-1 p-4 overflow-auto">
            <CodeBlock
              code={examples[activeExample].code}
              language={examples[activeExample].lang}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
