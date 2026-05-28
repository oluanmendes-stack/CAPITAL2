import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { format } from 'date-fns';

export function PierreDebug() {
  const [debugData, setDebugData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDebugCurrentMonth = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/pierre/debug-current-month');
      const data = await response.json();
      setDebugData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleDebugTransactions = async () => {
    setLoading(true);
    setError(null);
    try {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const params = new URLSearchParams();
      params.append('startDate', format(firstDay, 'yyyy-MM-dd'));
      params.append('endDate', format(lastDay, 'yyyy-MM-dd'));
      params.append('format', 'raw');
      params.append('includeStatus', 'POSTED');

      const response = await fetch(`/api/pierre/transactions?${params.toString()}`);
      const data = await response.json();
      setDebugData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleDebugBalance = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/pierre/balance');
      const data = await response.json();
      setDebugData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-orange-300 bg-orange-50">
      <CardHeader>
        <CardTitle className="text-orange-900">🐛 Debug Pierre Finance</CardTitle>
        <CardDescription className="text-orange-800">
          Use esses botões para verificar os dados retornados da API
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={handleDebugCurrentMonth}
            disabled={loading}
            variant="outline"
            size="sm"
          >
            Debug Mês Atual
          </Button>
          <Button
            onClick={handleDebugTransactions}
            disabled={loading}
            variant="outline"
            size="sm"
          >
            Debug Transações
          </Button>
          <Button
            onClick={handleDebugBalance}
            disabled={loading}
            variant="outline"
            size="sm"
          >
            Debug Saldo
          </Button>
        </div>

        {error && (
          <div className="p-3 bg-red-100 border border-red-300 rounded text-red-800 text-sm">
            <strong>Erro:</strong> {error}
          </div>
        )}

        {debugData && (
          <div className="p-3 bg-white border border-gray-200 rounded overflow-auto max-h-96">
            <pre className="text-xs font-mono whitespace-pre-wrap break-words">
              {JSON.stringify(debugData, null, 2)}
            </pre>
          </div>
        )}

        {loading && (
          <div className="text-sm text-gray-600">Carregando...</div>
        )}
      </CardContent>
    </Card>
  );
}
