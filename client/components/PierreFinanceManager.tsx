import { useState, useEffect } from 'react';
import { pierreFinanceService } from '../services/pierreFinanceService';
import { usePierreCreditCardTransactions } from '../hooks/usePierreCreditCardTransactions';
import {
  PierreConsolidatedBalance,
  PierreBalance,
  PierreInstallmentsResponse,
  PierreSyncResult
} from '@shared/pierre-types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  Loader2,
  RefreshCw,
  Wallet,
  CreditCard,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  Zap
} from 'lucide-react';

interface PierreFinanceManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function PierreFinanceManager({ open, onOpenChange }: PierreFinanceManagerProps) {
  const [activeTab, setActiveTab] = useState('accounts');
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [balances, setBalances] = useState<PierreBalance[]>([]);
  const [consolidatedBalance, setConsolidatedBalance] = useState<PierreConsolidatedBalance | null>(null);
  const [installmentsData, setInstallmentsData] = useState<PierreInstallmentsResponse | null>(null);
  const [syncResult, setSyncResult] = useState<PierreSyncResult | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);

  const { fetchAndIntegrateCreditCardTransactions } = usePierreCreditCardTransactions();

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open]);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [balancesData, consolidatedData, installments] = await Promise.all([
        pierreFinanceService.getBalances(),
        pierreFinanceService.getConsolidatedBalance(),
        pierreFinanceService.getInstallments()
      ]);

      setBalances(balancesData);
      setConsolidatedBalance(consolidatedData);
      setInstallmentsData(installments);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setError(null);
    try {
      const result = await pierreFinanceService.syncData();
      setSyncResult(result);
      setLastSync(new Date().toISOString());
      if (result.errors.length === 0) {
        // Reload data after sync
        await loadData();
        // Fetch and integrate credit card transactions
        await fetchAndIntegrateCreditCardTransactions();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao sincronizar');
    } finally {
      setIsSyncing(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col z-[101]">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              <div>
                <CardTitle>Pierre Finance - Suas Contas Financeiras</CardTitle>
                <CardDescription>
                  Visualize suas contas, saldos, transações e parcelas de todos os seus bancos
                </CardDescription>
              </div>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
            >
              ×
            </button>
          </div>
        </CardHeader>

        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <Alert className="mb-4 border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">{error}</AlertDescription>
            </Alert>
          )}

          {syncResult && syncResult.errors.length === 0 && (
            <Alert className="mb-4 border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Sincronização concluída! {syncResult.accountsCount} contas, {syncResult.transactionsImported} transações e {syncResult.installmentsFound} parcelas.
              </AlertDescription>
            </Alert>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="accounts">Contas e Saldos</TabsTrigger>
              <TabsTrigger value="installments">Parcelas</TabsTrigger>
              <TabsTrigger value="sync">Sincronização</TabsTrigger>
            </TabsList>

            {/* Contas e Saldos */}
            <TabsContent value="accounts" className="space-y-4">
              {isLoading ? (
                <div className="flex justify-center items-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
              ) : consolidatedBalance ? (
                <>
                  {/* Saldo Consolidado */}
                  <Card className="border-blue-200 bg-blue-50">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-blue-600" />
                        Saldo Consolidado
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <p className="text-sm text-gray-600">Saldo Total</p>
                          <p className="text-3xl font-bold text-blue-600">
                            {formatCurrency(consolidatedBalance.totalBalance)}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            Última atualização: {formatDate(consolidatedBalance.lastUpdate)}
                          </p>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="bg-white p-3 rounded border">
                            <p className="text-xs text-gray-600">Contas Correntes</p>
                            <p className="text-lg font-bold">
                              {formatCurrency(consolidatedBalance.balancesByType.checking)}
                            </p>
                          </div>
                          <div className="bg-white p-3 rounded border">
                            <p className="text-xs text-gray-600">Poupança</p>
                            <p className="text-lg font-bold">
                              {formatCurrency(consolidatedBalance.balancesByType.savings)}
                            </p>
                          </div>
                          <div className="bg-white p-3 rounded border">
                            <p className="text-xs text-gray-600">Cartões de Crédito</p>
                            <p className="text-lg font-bold text-red-600">
                              {formatCurrency(consolidatedBalance.balancesByType.credit_card)}
                            </p>
                          </div>
                          <div className="bg-white p-3 rounded border">
                            <p className="text-xs text-gray-600">Investimentos</p>
                            <p className="text-lg font-bold">
                              {formatCurrency(consolidatedBalance.balancesByType.investment)}
                            </p>
                          </div>
                        </div>

                        {Object.keys(consolidatedBalance.balancesByProvider).length > 0 && (
                          <div>
                            <p className="text-sm font-medium mb-2">Por Provedor</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {Object.entries(consolidatedBalance.balancesByProvider).map(([provider, balance]) => (
                                <div key={provider} className="flex justify-between items-center bg-white p-2 rounded text-sm">
                                  <span className="capitalize">{provider}</span>
                                  <span className={balance >= 0 ? 'text-green-600' : 'text-red-600'}>
                                    {formatCurrency(balance)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Contas Individuais */}
                  <div>
                    <h3 className="font-semibold text-lg mb-3">Contas Conectadas</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {balances.map((balance, idx) => (
                        <Card key={balance.accountId || `balance-${idx}`}>
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {balance.accountType === 'credit_card' ? (
                                  <CreditCard className="h-5 w-5 text-amber-600" />
                                ) : (
                                  <Wallet className="h-5 w-5 text-blue-600" />
                                )}
                                <div className="flex-1">
                                  <CardTitle className="text-base">{balance.accountName}</CardTitle>
                                  {balance.bankName && (
                                    <p className="text-xs text-gray-500 capitalize">{balance.bankName}</p>
                                  )}
                                </div>
                              </div>
                              <Badge variant="outline" className="capitalize">
                                {balance.accountType === 'credit_card' ? 'Cartão' : balance.accountType === 'checking' ? 'Corrente' : 'Poupança'}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            <div>
                              <p className="text-sm text-gray-600">Saldo</p>
                              <p className={`text-2xl font-bold ${balance.balance != null && balance.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {balance.balance != null ? formatCurrency(balance.balance) : 'N/A'}
                              </p>
                            </div>
                            {balance.availableBalance !== undefined && (
                              <div>
                                <p className="text-sm text-gray-600">Disponível</p>
                                <p className="text-sm font-semibold">
                                  {formatCurrency(balance.availableBalance)}
                                </p>
                              </div>
                            )}
                            <p className="text-xs text-gray-500 pt-2 border-t">
                              Atualizado em {formatDate(balance.lastUpdate)}
                            </p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>Nenhuma conta conectada. Configure suas credenciais do Pierre.</AlertDescription>
                </Alert>
              )}
            </TabsContent>

            {/* Parcelas */}
            <TabsContent value="installments" className="space-y-4">
              {isLoading ? (
                <div className="flex justify-center items-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
              ) : installmentsData?.data?.purchases && installmentsData.data.purchases.length > 0 ? (
                <div className="space-y-4">
                  {/* Resumo de Parcelas */}
                  <Card className="border-blue-200 bg-blue-50">
                    <CardHeader>
                      <CardTitle className="text-lg">Resumo de Parcelas</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-xs text-gray-600">Total de Compras</p>
                          <p className="text-2xl font-bold text-blue-600">
                            {installmentsData.data.summary.totalPurchases}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">Total de Parcelas</p>
                          <p className="text-2xl font-bold text-blue-600">
                            {installmentsData.data.summary.totalInstallments}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">Valor Total</p>
                          <p className="text-2xl font-bold text-blue-600">
                            {formatCurrency(installmentsData.data.summary.totalAmount)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">Atualizado em</p>
                          <p className="text-sm font-semibold">
                            {formatDate(installmentsData.data.timestamp)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Detalhamento de Compras */}
                  {installmentsData.data.purchases.map((purchase, purchaseIdx) => (
                    <Card key={purchase.id || `purchase_${purchaseIdx}`}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-base">
                              Compra de {formatCurrency(purchase.totalAmount)}
                            </CardTitle>
                            <CardDescription>
                              {purchase.installments.length} parcelas
                            </CardDescription>
                          </div>
                          <Badge variant="outline">{purchase.installments.length}x</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <p className="text-sm font-medium mb-2">Cronograma de Pagamentos:</p>
                          <div className="space-y-2">
                            {purchase.installments.slice(0, 6).map((installment, idx) => (
                              <div
                                key={installment.id || `installment_${purchaseIdx}_${installment.installmentNumber}`}
                                className="flex items-center justify-between p-3 bg-gray-50 rounded text-sm"
                              >
                                <div className="flex items-center gap-2">
                                  {installment.status === 'POSTED' && (
                                    <CheckCircle className="h-4 w-4 text-green-600" />
                                  )}
                                  {installment.status === 'PENDING' && (
                                    <Clock className="h-4 w-4 text-blue-600" />
                                  )}
                                  {installment.status === 'OVERDUE' && (
                                    <AlertCircle className="h-4 w-4 text-red-600" />
                                  )}
                                  <div>
                                    <p className="font-medium">
                                      Parcela {installment.installmentNumber}/{installment.totalInstallments}
                                    </p>
                                    {installment.description && (
                                      <p className="text-xs text-gray-600">{installment.description}</p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="font-semibold">{formatCurrency(installment.amount)}</span>
                                  <span className="text-gray-600 text-xs whitespace-nowrap">
                                    {formatDate(installment.dueDate)}
                                  </span>
                                </div>
                              </div>
                            ))}
                            {purchase.installments.length > 6 && (
                              <p key={`remaining_${purchaseIdx}`} className="text-xs text-gray-500 p-2">
                                +{purchase.installments.length - 6} parcelas...
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>Nenhuma parcela encontrada.</AlertDescription>
                </Alert>
              )}
            </TabsContent>

            {/* Sincronização */}
            <TabsContent value="sync" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <RefreshCw className="h-5 w-5" />
                    Sincronização de Dados
                  </CardTitle>
                  <CardDescription>
                    Force uma atualização manual dos dados do Pierre Finance
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Alert className="border-blue-200 bg-blue-50">
                    <Zap className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-blue-900">
                      A sincronização irá atualizar suas contas, saldos, transações e parcelas dos últimos 90 dias.
                    </AlertDescription>
                  </Alert>

                  <Button
                    onClick={handleSync}
                    disabled={isSyncing}
                    className="w-full"
                    size="lg"
                  >
                    {isSyncing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Sincronizando...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Sincronizar Agora
                      </>
                    )}
                  </Button>

                  {lastSync && (
                    <p className="text-sm text-gray-600 text-center">
                      Última sincronização: {new Date(lastSync).toLocaleString('pt-BR')}
                    </p>
                  )}

                  {syncResult && (
                    <Card className="bg-gray-50">
                      <CardContent className="pt-6">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="text-center">
                            <p className="text-2xl font-bold text-blue-600">{syncResult.accountsCount}</p>
                            <p className="text-sm text-gray-600">Contas</p>
                          </div>
                          <div className="text-center">
                            <p className="text-2xl font-bold text-green-600">{syncResult.transactionsImported}</p>
                            <p className="text-sm text-gray-600">Transações</p>
                          </div>
                          <div className="text-center">
                            <p className="text-2xl font-bold text-amber-600">{syncResult.installmentsFound}</p>
                            <p className="text-sm text-gray-600">Parcelas</p>
                          </div>
                          <div className="text-center">
                            <p className="text-sm text-gray-600">Em</p>
                            <p className="text-sm font-semibold">
                              {new Date(syncResult.timestamp).toLocaleTimeString('pt-BR')}
                            </p>
                          </div>
                        </div>

                        {syncResult.errors.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-gray-300">
                            <p className="text-sm font-medium text-red-600 mb-2">Erros encontrados:</p>
                            {syncResult.errors.map((err, idx) => (
                              <p key={idx} className="text-xs text-red-500 mb-1">
                                • {err}
                              </p>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </Card>
    </div>
  );
}
