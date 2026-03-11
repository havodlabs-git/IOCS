import { AlertTriangle, Shield, X } from 'lucide-react';
import { IocData } from './IocUploader';

interface IocTableProps {
  iocs: IocData[];
}

export function IocTable({ iocs }: IocTableProps) {
  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical':
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical':
      case 'high':
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return <Shield className="w-4 h-4" />;
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      <div className="p-6 border-b border-slate-200">
        <h2>IOCs Carregados</h2>
        <p className="text-slate-600 mt-1">
          Total de {iocs.length} indicador{iocs.length !== 1 ? 'es' : ''} de comprometimento
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-slate-600">
                Tipo
              </th>
              <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-slate-600">
                Valor
              </th>
              <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-slate-600">
                Severidade
              </th>
              <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-slate-600">
                Descrição
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {iocs.map((ioc) => (
              <tr key={ioc.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs border bg-slate-50 text-slate-700 border-slate-200">
                    {ioc.type}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <code className="text-sm text-slate-900 bg-slate-100 px-2 py-1 rounded">
                    {ioc.value}
                  </code>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border ${getSeverityColor(
                      ioc.severity
                    )}`}
                  >
                    {getSeverityIcon(ioc.severity)}
                    {ioc.severity}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">
                  {ioc.description || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {iocs.length === 0 && (
        <div className="p-12 text-center">
          <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <X className="w-8 h-8 text-slate-400" />
          </div>
          <p className="text-slate-600">Nenhum IOC carregado</p>
        </div>
      )}
    </div>
  );
}
