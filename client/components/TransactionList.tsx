import { useState, useMemo, useEffect } from 'react';
import { useFinancial } from '../contexts/FinancialContext';
import { useContextSync } from '../hooks/useContextSync';
import { Transaction, TransactionType } from '@shared/financial-types';
import { PierreTransaction, PierreTransactionsResponse } from '@shared/pierre-types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Calendar } from './ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import ExportModal from './ExportModal';
import TransactionModal from './TransactionModal';
import {
  Search,
  Filter,
  CalendarIcon,
  Edit,
  Trash2,
  ChevronDown,
  Download,
  ArrowUpDown,
  AlertCircle,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import { format, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '../lib/utils';

interface TransactionListProps {
  showFilters?: boolean;
}

type SortField = 'date' | 'amount' | 'category' | 'description' | 'source';
type SortDirection = 'asc' | 'desc';

interface CombinedTransaction {
  id: string;
  type: 'receita' | 'despesa' | 'DEBIT' | 'CREDIT';
  amount: number;
  date: string;
  description: string;
  category?: string;
  categoryName?: string;
  source: 'manual' | 'import' | 'pierre';
  status?: 'POSTED' | 'PENDING';
  account_name?: string;
}

export default function TransactionList({ showFilters = true }: TransactionListProps) {
  const {
    transactions,
    categories,
    deleteTransaction,
    filters,
    setFilters,
    getFilteredTransactions
  } = useFinancial();

  const { onTransactionDeleted } = useContextSync();

  const [searchTerm, setSearchTerm] = useState(filters.search || '');
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [transactionToEdit, setTransactionToEdit] = useState<Transaction | null>(null);
  const [selectedMonth, setSelectedMonth] = useState('all');

  // Pierre transactions
  const [pierreTransactions, setPierreTransactions] = useState<PierreTransaction[]>([]);
  const [pierreLoading, setPierreLoading] = useState(false);
  const [pierreError, setPierreError] = useState<string | null>(null);
  const [showPierreTransactions, setShowPierreTransactions] = useState(true);

  // Fetch Pierre transactions on mount
  useEffect(() => {
    const fetchPierreTransactions = async () => {
      setPierreLoading(true);
      setPierreError(null);
      try {
        const startDate = subMonths(new Date(), 3);
        const params = new URLSearchParams();
        params.append('startDate', format(startDate, 'yyyy-MM-dd'));
        params.append('endDate', format(new Date(), 'yyyy-MM-dd'));
        params.append('format', 'raw');

        const response = await fetch(`/api/pierre/transactions?${params.toString()}`);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `API error: ${response.statusText}`);
        }

        const data: PierreTransactionsResponse = await response.json();
        if (data.success) {
          setPierreTransactions(data.data || []);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao buscar transações do Pierre';
        setPierreError(message);
        console.error('Error fetching Pierre transactions:', err);
      } finally {
        setPierreLoading(false);
      }
    };

    if (showPierreTransactions) {
      fetchPierreTransactions();
    }
  }, [showPierreTransactions]);

  // Combine regular and Pierre transactions
  const combinedTransactions = useMemo((): CombinedTransaction[] => {
    const regular = transactions.map(t => ({
      ...t,
      source: (t.source || 'manual') as 'manual' | 'import' | 'pierre'
    })) as CombinedTransaction[];

    const pierre = pierreTransactions.map(t => ({
      id: t.id,
      type: t.type as 'DEBIT' | 'CREDIT',
      amount: t.amount,
      date: t.date,
      description: t.description,
      category: t.category,
      categoryName: t.category,
      source: 'pierre' as const,
      status: t.status,
      account_name: t.account_name
    })) as CombinedTransaction[];

    return showPierreTransactions ? [...regular, ...pierre] : regular;
  }, [transactions, pierreTransactions, showPierreTransactions]);

  // Gerar lista de meses disponíveis
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    combinedTransactions.forEach(transaction => {
      const date = new Date(transaction.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      months.add(monthKey);
    });

    return Array.from(months).sort().reverse().map(monthKey => {
      const [year, month] = monthKey.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1);
      return {
        key: monthKey,
        label: format(date, 'MMMM yyyy', { locale: ptBR }),
        year: parseInt(year),
        month: parseInt(month)
      };
    });
  }, [combinedTransactions]);

  // Aplicar filtro de mês
  const handleMonthFilter = (monthKey: string) => {
    setSelectedMonth(monthKey);
    if (monthKey && monthKey !== 'all') {
      const [year, month] = monthKey.split('-');
      const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
      const endDate = new Date(parseInt(year), parseInt(month), 0);

      setFilters({
        ...filters,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      });
    } else {
      setFilters({
        ...filters,
        startDate: undefined,
        endDate: undefined
      });
    }
  };

  // Aplicar filtros e buscas
  const filteredTransactions = useMemo(() => {
    let filtered = [...combinedTransactions];

    // Aplicar filtro de data
    if (filters.startDate) {
      filtered = filtered.filter(t => new Date(t.date) >= new Date(filters.startDate!));
    }
    if (filters.endDate) {
      filtered = filtered.filter(t => new Date(t.date) <= new Date(filters.endDate!));
    }

    // Aplicar busca local
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(t =>
        t.description.toLowerCase().includes(search) ||
        t.categoryName?.toLowerCase().includes(search) ||
        t.amount.toString().includes(search)
      );
    }

    // Aplicar ordenação
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortField) {
        case 'date':
          aValue = new Date(a.date);
          bValue = new Date(b.date);
          break;
        case 'amount':
          aValue = a.amount;
          bValue = b.amount;
          break;
        case 'category':
          aValue = a.categoryName || a.category;
          bValue = b.categoryName || b.category;
          break;
        case 'description':
          aValue = a.description;
          bValue = b.description;
          break;
        case 'source':
          aValue = a.source;
          bValue = b.source;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [combinedTransactions, searchTerm, sortField, sortDirection, filters.startDate, filters.endDate]);

  const handleSearch = () => {
    setFilters({ ...filters, search: searchTerm });
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta transação?')) {
      deleteTransaction(id);
      onTransactionDeleted(id);
    }
  };

  const handleEdit = (transaction: Transaction) => {
    setTransactionToEdit(transaction);
    setEditModalOpen(true);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'dd/MM/yyyy', { locale: ptBR });
  };

  const getCategoryInfo = (categoryId: string) => {
    return categories.find(cat => cat.id === categoryId);
  };

  const clearFilters = () => {
    setFilters({});
    setSearchTerm('');
  };

  const getTransactionColor = (type: string) => {
    if (type === 'receita' || type === 'CREDIT') return 'text-green-600';
    if (type === 'despesa' || type === 'DEBIT') return 'text-red-600';
    return 'text-gray-600';
  };

  const getSourceBadge = (source: string) => {
    if (source === 'pierre') return <Badge variant="outline" className="bg-purple-50">Pierre</Badge>;
    if (source === 'import') return <Badge variant="outline">Importado</Badge>;
    return null;
  };

  const getStatusBadge = (status?: string) => {
    if (status === 'PENDING') return <Badge variant="secondary">Pendente</Badge>;
    if (status === 'POSTED') return <Badge variant="default">Finalizado</Badge>;
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Pierre Error Alert */}
      {pierreError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {pierreError}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPierreError(null)}
              className="ml-2"
            >
              Descartar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Barra de Busca e Filtros */}
      {showFilters && (
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle>Filtros e Busca</CardTitle>
                <CardDescription>
                  Encontre e organize suas transações
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilterPanel(!showFilterPanel)}
                className="w-full sm:w-auto"
              >
                <Filter className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Filtros Avançados</span>
                <span className="sm:hidden">Filtros</span>
                <ChevronDown className={cn(
                  "h-4 w-4 ml-2 transition-transform",
                  showFilterPanel && "rotate-180"
                )} />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Busca */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar por descrição, categoria..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-10"
                />
              </div>
              <Button onClick={handleSearch} className="w-full sm:w-auto">
                Buscar
              </Button>
            </div>

            {/* Filtro Rápido por Mês */}
            <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
              <Label className="text-sm font-medium text-gray-600 min-w-fit">Filtrar por mês:</Label>
              <div className="flex-1 flex gap-2">
                <Select value={selectedMonth} onValueChange={handleMonthFilter}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Todos os meses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os meses</SelectItem>
                    {availableMonths.map((month) => (
                      <SelectItem key={month.key} value={month.key}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedMonth && selectedMonth !== 'all' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleMonthFilter('all')}
                    className="px-3"
                  >
                    Limpar
                  </Button>
                )}
              </div>
            </div>

            {/* Filtros Avançados */}
            {showFilterPanel && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t">
                {/* Tipo */}
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select
                    value={filters.type || 'all'}
                    onValueChange={(value) => 
                      setFilters({ 
                        ...filters, 
                        type: value === 'all' ? undefined : value as TransactionType 
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="receita">Receitas</SelectItem>
                      <SelectItem value="despesa">Despesas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Categoria */}
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select
                    value={filters.categories?.[0] || 'all'}
                    onValueChange={(value) => 
                      setFilters({ 
                        ...filters, 
                        categories: value === 'all' ? undefined : [value] 
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.icon} {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Data Início */}
                <div className="space-y-2">
                  <Label>Data Início</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {filters.startDate ? 
                          format(new Date(filters.startDate), 'dd/MM/yyyy', { locale: ptBR }) : 
                          'Selecionar'
                        }
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={filters.startDate ? new Date(filters.startDate) : undefined}
                        onSelect={(date) => 
                          setFilters({ 
                            ...filters, 
                            startDate: date ? date.toISOString().split('T')[0] : undefined 
                          })
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Data Fim */}
                <div className="space-y-2">
                  <Label>Data Fim</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {filters.endDate ? 
                          format(new Date(filters.endDate), 'dd/MM/yyyy', { locale: ptBR }) : 
                          'Selecionar'
                        }
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={filters.endDate ? new Date(filters.endDate) : undefined}
                        onSelect={(date) => 
                          setFilters({ 
                            ...filters, 
                            endDate: date ? date.toISOString().split('T')[0] : undefined 
                          })
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}

            {/* Botões de Ação */}
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button variant="outline" onClick={clearFilters} className="w-full sm:w-auto">
                Limpar Filtros
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPierreTransactions(!showPierreTransactions)}
              >
                {showPierreTransactions ? '✓' : ''} Incluir Pierre
              </Button>
              {pierreLoading && (
                <Button variant="outline" disabled>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Carregando Pierre...
                </Button>
              )}
              <ExportModal
                open={exportModalOpen}
                onOpenChange={setExportModalOpen}
              >
                <Button variant="outline" className="w-full sm:w-auto">
                  <Download className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Exportar Lista</span>
                  <span className="sm:hidden">Exportar</span>
                </Button>
              </ExportModal>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de Transações */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle>Transações</CardTitle>
              <CardDescription>
                {filteredTransactions.length} transação(ões) encontrada(s)
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Select value={`${sortField}-${sortDirection}`} onValueChange={(value) => {
                const [field, direction] = value.split('-') as [SortField, SortDirection];
                setSortField(field);
                setSortDirection(direction);
              }}>
                <SelectTrigger className="w-full sm:w-40">
                  <ArrowUpDown className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date-desc">Data (Recente)</SelectItem>
                  <SelectItem value="date-asc">Data (Antiga)</SelectItem>
                  <SelectItem value="amount-desc">Valor (Maior)</SelectItem>
                  <SelectItem value="amount-asc">Valor (Menor)</SelectItem>
                  <SelectItem value="category-asc">Categoria (A-Z)</SelectItem>
                  <SelectItem value="description-asc">Descrição (A-Z)</SelectItem>
                  <SelectItem value="source-asc">Origem (A-Z)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Search className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg">Nenhuma transação encontrada</p>
              <p className="text-sm">Tente ajustar os filtros ou adicionar novas transações</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTransactions.map((transaction) => {
                const category = transaction.source === 'pierre' ? null : getCategoryInfo(transaction.category);
                const isRegular = transaction.source === 'manual' || transaction.source === 'import';
                return (
                  <div
                    key={transaction.id}
                    className={`flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-lg border hover:bg-gray-50 transition-colors ${
                      transaction.source === 'pierre' ? 'border-purple-100 bg-purple-50' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className="text-2xl flex-shrink-0">
                        {category?.icon || '💰'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium truncate">{transaction.description}</h3>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <Badge
                            variant={transaction.type === 'receita' || transaction.type === 'CREDIT' ? 'default' : 'secondary'}
                            className={transaction.type === 'receita' || transaction.type === 'CREDIT' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}
                          >
                            {category?.name || transaction.categoryName || transaction.category}
                          </Badge>
                          <span className="text-sm text-gray-500">
                            {formatDate(transaction.date)}
                          </span>
                          {transaction.account_name && (
                            <span className="text-xs text-gray-500">
                              {transaction.account_name}
                            </span>
                          )}
                          {getSourceBadge(transaction.source)}
                          {getStatusBadge(transaction.status)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-3">
                      <div className={`text-lg font-semibold ${getTransactionColor(transaction.type)}`}>
                        {transaction.type === 'receita' || transaction.type === 'CREDIT' ? '+' : '-'}{formatCurrency(transaction.amount)}
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        {isRegular && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(transaction as Transaction)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(transaction.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Edição */}
      <TransactionModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        transactionToEdit={transactionToEdit}
      />
    </div>
  );
}
