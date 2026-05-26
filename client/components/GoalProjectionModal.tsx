import { useState } from 'react';
import { useFinancial } from '../contexts/FinancialContext';
import { useBudget } from '../contexts/BudgetContext';
import { useFGTSAnalysis } from '../hooks/useFGTSAnalysis';
import { useFinancialSummary } from '../hooks/useFinancialSummary';
import { GoalWithStatus } from '@shared/goal-types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Checkbox } from './ui/checkbox';
import { Calculator, TrendingUp, AlertTriangle, CheckCircle, Calendar, DollarSign } from 'lucide-react';
import { format, differenceInMonths, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface GoalProjectionModalProps {
  goal: GoalWithStatus;
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

interface ProjectionResult {
  isViable: boolean;
  totalProjected: number;
  monthlyIncomeNeeded?: number;
  alternativeDate?: Date;
  monthlySavings: number;
  monthsRemaining: number;
  monthsToReachGoal?: number;
}

export default function GoalProjectionModal({ goal, children, open, onOpenChange }: GoalProjectionModalProps) {
  const { summary: financialSummary, fgtsBalance } = useFinancial();
  const { summary: budgetSummary, getCurrentMonthExpenses, getCategoriesStatus } = useBudget();
  const fgtsAnalysis = useFGTSAnalysis();
  const financialSummaryExt = useFinancialSummary();

  const [monthlyIncome, setMonthlyIncome] = useState<string>(financialSummaryExt.monthlyReceitas.toString());
  const [monthlyExpenses, setMonthlyExpenses] = useState<string>(financialSummaryExt.monthlyDespesas.toString());
  const [expenseType, setExpenseType] = useState<'budget' | 'actual'>('actual');
  const [selectedMonthOffset, setSelectedMonthOffset] = useState('0'); // 0 = current month, -1 = last month, etc.
  const [useFGTS, setUseFGTS] = useState(false);
  const [includeFGTSEarnings, setIncludeFGTSEarnings] = useState(fgtsAnalysis.hasActiveEarnings);
  const [result, setResult] = useState<ProjectionResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (date: Date) => {
    return format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  };

  const getMonthlyExpenses = () => {
    if (expenseType === 'budget') {
      // Usar gastos fixos cadastrados - especificamente da categoria "Gastos Fixos"
      const categoriesStatus = getCategoriesStatus();
      const gastosFixosCategory = categoriesStatus.find(cat =>
        cat.category.name.toLowerCase().includes('gastos fixos') ||
        cat.category.name.toLowerCase().includes('gastos fixo') ||
        cat.category.name.toLowerCase().includes('fixos')
      );

      if (gastosFixosCategory) {
        return gastosFixosCategory.category.monthlyLimit;
      } else {
        // Se não encontrar categoria específica, usar total de todas as categorias
        return categoriesStatus.reduce((total, cat) => total + cat.category.monthlyLimit, 0);
      }
    } else {
      // Usar gastos reais do último mês
      return financialSummary.totalDespesas;
    }
  };

  const calculateProjection = () => {
    setIsCalculating(true);

    try {
      const income = parseFloat(monthlyIncome.replace(',', '.')) || 0;
      const userExpenses = parseFloat(monthlyExpenses.replace(',', '.')) || 0;

      // Usar despesas do formulário ou do cálculo padrão
      const expenses = expenseType === 'actual' ? userExpenses : getMonthlyExpenses();
      const monthlySavings = income - expenses;

      const targetDate = new Date(goal.deadline);
      const currentDate = new Date();
      const monthsRemaining = Math.max(1, differenceInMonths(targetDate, currentDate) + 1); // +1 para incluir o mês atual

      let currentAmount = goal.currentAmount;
      let fgtsEarningsProjection = 0;
      const actualFGTSBalance = fgtsBalance || 0; // Garantir que não é undefined

      // Se usar FGTS na projeção, adicionar ao valor atual
      if (useFGTS && actualFGTSBalance > 0) {
        currentAmount += actualFGTSBalance;

        // Se incluir rendimentos do FGTS, projetar crescimento
        if (includeFGTSEarnings && fgtsAnalysis.estimatedAnnualRate > 0) {
          for (let month = 0; month < monthsRemaining; month++) {
            const monthlyRate = fgtsAnalysis.estimatedAnnualRate / 12;
            const fgtsAtMonth = actualFGTSBalance + fgtsEarningsProjection;
            fgtsEarningsProjection += fgtsAtMonth * monthlyRate;
          }
        }
      }

      const remainingAmount = Math.max(0, goal.targetAmount - currentAmount);
      const totalProjected = currentAmount + fgtsEarningsProjection + (monthlySavings * monthsRemaining);

      // Verificar viabilidade considerando:
      // 1. Se o valor projetado atinge o objetivo
      // 2. Se a sobra mensal é positiva
      // 3. Se há tempo suficiente para atingir o objetivo
      const isViable = totalProjected >= goal.targetAmount && monthlySavings >= 0;

      // Se é viável, calcular quando o objetivo seria atingido
      let monthsToReachGoal = monthsRemaining;
      let projectedValue = totalProjected;

      if (isViable && monthlySavings > 0 && remainingAmount > 0) {
        // Calcular quantos meses realmente seriam necessários
        monthsToReachGoal = Math.ceil(remainingAmount / monthlySavings);

        // Se consegue atingir antes da data limite, mostrar o valor do objetivo
        if (monthsToReachGoal <= monthsRemaining) {
          projectedValue = goal.targetAmount;
        }
      }

      let projectionResult: ProjectionResult = {
        isViable,
        totalProjected: projectedValue,
        monthlySavings,
        monthsRemaining,
        monthsToReachGoal
      };

      // Se não for viável, calcular alternativas
      if (!projectionResult.isViable) {
        // Calcular receita mensal necessária (apenas se há tempo suficiente)
        if (monthsRemaining > 0) {
          const monthlyIncomeNeeded = expenses + (remainingAmount / monthsRemaining);
          projectionResult.monthlyIncomeNeeded = monthlyIncomeNeeded;
        }

        // Calcular data alternativa (se a sobra mensal for positiva)
        if (monthlySavings > 0) {
          const monthsNeededForGoal = Math.ceil(remainingAmount / monthlySavings);
          const alternativeDate = addMonths(currentDate, monthsNeededForGoal);
          projectionResult.alternativeDate = alternativeDate;
        }
      }

      setResult(projectionResult);
    } catch (error) {
      console.error('Erro no cálculo de projeção:', error);
    } finally {
      setIsCalculating(false);
    }
  };

  const resetCalculation = () => {
    setResult(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto mx-4 w-[calc(100vw-2rem)] sm:w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Projeção de Viabilidade - {goal.name}
          </DialogTitle>
          <DialogDescription>
            Simule se conseguirá atingir seu objetivo na data planejada com sua situação financeira atual
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Dados do Objetivo */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">📊 Dados do Objetivo</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-gray-600">Valor do Objetivo</Label>
                <p className="font-semibold text-lg">{formatCurrency(goal.targetAmount)}</p>
              </div>
              <div>
                <Label className="text-sm text-gray-600">Valor Acumulado</Label>
                <p className="font-semibold text-lg text-green-600">{formatCurrency(goal.currentAmount)}</p>
              </div>
              <div>
                <Label className="text-sm text-gray-600">Valor Restante</Label>
                <p className="font-semibold text-lg text-orange-600">{formatCurrency(goal.remainingAmount)}</p>
              </div>
              <div>
                <Label className="text-sm text-gray-600">Data Limite</Label>
                <p className="font-semibold text-lg">{formatDate(new Date(goal.deadline))}</p>
              </div>
            </CardContent>
          </Card>

          {/* Configuração da Simulação */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">⚙️ Configuração da Simulação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="monthlyIncome">Receita Mensal (R$) *</Label>
                  <Input
                    id="monthlyIncome"
                    type="number"
                    step="any"
                    value={monthlyIncome}
                    onChange={(e) => setMonthlyIncome(e.target.value)}
                    placeholder="0,00"
                  />
                  <p className="text-xs text-gray-500">
                    Detectado: {formatCurrency(financialSummaryExt.monthlyReceitas)}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="monthlyExpensesInput">Despesas Mensais (R$) *</Label>
                  <Input
                    id="monthlyExpensesInput"
                    type="number"
                    step="any"
                    value={monthlyExpenses}
                    onChange={(e) => setMonthlyExpenses(e.target.value)}
                    placeholder="0,00"
                  />
                  <p className="text-xs text-gray-500">
                    Detectado: {formatCurrency(financialSummaryExt.monthlyDespesas)}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="monthSelect">Selecione o Mês da Simulação (Referência)</Label>
                <Select value={selectedMonthOffset} onValueChange={setSelectedMonthOffset}>
                  <SelectTrigger id="monthSelect">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="-2">{format(subMonths(new Date(), 2), 'MMMM yyyy', { locale: ptBR })}</SelectItem>
                    <SelectItem value="-1">{format(subMonths(new Date(), 1), 'MMMM yyyy', { locale: ptBR })}</SelectItem>
                    <SelectItem value="0">{format(new Date(), 'MMMM yyyy', { locale: ptBR })} (atual)</SelectItem>
                    <SelectItem value="1">{format(addMonths(new Date(), 1), 'MMMM yyyy', { locale: ptBR })}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tipo de Gastos para Simulação</Label>
                <Select value={expenseType} onValueChange={(value) => setExpenseType(value as 'budget' | 'actual')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="actual">
                      Gastos Reais do Mês Selecionado
                      <span className="block text-xs text-gray-500">
                        {formatCurrency(financialSummary.totalDespesas)}
                      </span>
                    </SelectItem>
                    <SelectItem value="budget">
                      Gastos Fixos (Categoria "Gastos Fixos")
                      <span className="block text-xs text-gray-500">
                        {(() => {
                          const categoriesStatus = getCategoriesStatus();
                          const gastosFixosCategory = categoriesStatus.find(cat =>
                            cat.category.name.toLowerCase().includes('gastos fixos') ||
                            cat.category.name.toLowerCase().includes('gastos fixo') ||
                            cat.category.name.toLowerCase().includes('fixos')
                          );
                          return formatCurrency(gastosFixosCategory?.category.monthlyLimit || 0);
                        })()}
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
                {expenseType === 'budget' && (() => {
                  const categoriesStatus = getCategoriesStatus();
                  const gastosFixosCategory = categoriesStatus.find(cat =>
                    cat.category.name.toLowerCase().includes('gastos fixos') ||
                    cat.category.name.toLowerCase().includes('gastos fixo') ||
                    cat.category.name.toLowerCase().includes('fixos')
                  );
                  if (!gastosFixosCategory) {
                    return (
                      <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded p-2">
                        ⚠️ Categoria "Gastos Fixos" não encontrada. Usando total de todas as categorias.
                      </p>
                    );
                  }
                  return (
                    <p className="text-xs text-green-600 bg-green-50 border border-green-200 rounded p-2">
                      ✅ Usando categoria "{gastosFixosCategory.category.name}" - {formatCurrency(gastosFixosCategory.category.monthlyLimit)}
                    </p>
                  );
                })()}
              </div>

              {/* FGTS Option */}
              {fgtsBalance > 0 && (
                <div className="border rounded-lg p-4 bg-blue-50 space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="useFGTS"
                      checked={useFGTS}
                      onCheckedChange={(checked) => setUseFGTS(!!checked)}
                    />
                    <Label htmlFor="useFGTS" className="font-medium text-blue-900">
                      Usar Saldo FGTS ({formatCurrency(fgtsBalance)}) na Simulação
                    </Label>
                  </div>
                  <p className="text-xs text-blue-700 ml-6">
                    O saldo de FGTS será considerado como valor inicial do objetivo.
                  </p>

                  {useFGTS && fgtsAnalysis.hasActiveEarnings && (
                    <div className="border-t border-blue-200 pt-3">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="includeFGTSEarnings"
                          checked={includeFGTSEarnings}
                          onCheckedChange={(checked) => setIncludeFGTSEarnings(!!checked)}
                        />
                        <Label htmlFor="includeFGTSEarnings" className="font-medium text-blue-900">
                          Incluir Rendimentos do FGTS na Projeção
                        </Label>
                      </div>
                      <p className="text-xs text-blue-700 ml-6 mt-2">
                        Taxa Estimada: {(fgtsAnalysis.estimatedAnnualRate * 100).toFixed(2)}% a.a.
                        <br />
                        Rendimento Médio: {formatCurrency(fgtsAnalysis.projection12Months.monthlyAvgEarning)}/mês
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3">
                <Button onClick={calculateProjection} disabled={isCalculating} className="flex-1">
                  {isCalculating ? 'Calculando...' : 'Calcular Projeção'}
                </Button>
                {result && (
                  <Button variant="outline" onClick={resetCalculation}>
                    Nova Simulação
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Resultado da Projeção */}
          {result && (
            <Card className={result.isViable ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
              <CardHeader>
                <CardTitle className={`text-lg flex items-center gap-2 ${result.isViable ? 'text-green-800' : 'text-red-800'}`}>
                  {result.isViable ? (
                    <>
                      <CheckCircle className="h-5 w-5" />
                      ✅ Objetivo Viável!
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-5 w-5" />
                      ⚠️ Objetivo Inviável
                    </>
                  )}
                </CardTitle>
                <div className={`text-sm ${result.isViable ? 'text-green-700' : 'text-red-700'}`}>
                  {result.isViable ? (
                    <p>
                      ✨ Com sua sobra mensal de {formatCurrency(result.monthlySavings)}, você conseguirá atingir este objetivo
                      {result.monthsToReachGoal && result.monthsToReachGoal < result.monthsRemaining
                        ? ` em ${result.monthsToReachGoal} mês${result.monthsToReachGoal !== 1 ? 'es' : ''} (antes da data limite)!`
                        : ` até ${formatDate(new Date(goal.deadline))}!`
                      }
                    </p>
                  ) : (
                    <p>
                      {result.monthlySavings <= 0
                        ? `💸 Sua sobra mensal é negativa (${formatCurrency(result.monthlySavings)}). Você precisa aumentar a receita ou reduzir gastos.`
                        : `📅 Sua sobra mensal de ${formatCurrency(result.monthlySavings)} é insuficiente para atingir o objetivo na data planejada.`
                      }
                    </p>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Resumo da Situação */}
                <div className={`border rounded-lg p-4 ${result.isViable ? 'border-green-300 bg-white' : 'border-red-300 bg-white'}`}>
                  <h4 className="font-semibold mb-3">📈 Resumo da Projeção</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-gray-600">Sobra Mensal</Label>
                      <p className={`font-semibold ${result.monthlySavings > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(result.monthlySavings)}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-600">Meses Restantes</Label>
                      <p className="font-semibold">{result.monthsRemaining} meses</p>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-600">
                        {result.isViable && result.totalProjected === goal.targetAmount
                          ? "Valor do Objetivo (Atingido)"
                          : "Valor Projetado"
                        }
                      </Label>
                      <p className={`font-semibold text-lg ${result.isViable ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(result.totalProjected)}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-600">Diferença</Label>
                      <p className={`font-semibold ${result.isViable ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(result.totalProjected - goal.targetAmount)}
                      </p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Alternativas (se inviável) */}
                {!result.isViable && (
                  <div className="space-y-4">
                    <h4 className="font-semibold text-orange-800">💡 Alternativas Sugeridas</h4>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Opção 1: Aumentar Receita */}
                      {result.monthlyIncomeNeeded && (
                        <Card className="border-blue-200 bg-blue-50">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm text-blue-800 flex items-center gap-2">
                              <DollarSign className="h-4 w-4" />
                              Opção 1: Aumentar Receita
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-blue-700 mb-2">
                              Receita mensal necessária:
                            </p>
                            <p className="font-bold text-lg text-blue-900">
                              {formatCurrency(result.monthlyIncomeNeeded)}
                            </p>
                            <p className="text-xs text-blue-600 mt-1">
                              Aumento de {formatCurrency(result.monthlyIncomeNeeded - parseFloat(monthlyIncome.replace(',', '.')))}
                            </p>
                          </CardContent>
                        </Card>
                      )}

                      {/* Opção 2: Estender Prazo */}
                      {result.alternativeDate && (
                        <Card className="border-purple-200 bg-purple-50">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm text-purple-800 flex items-center gap-2">
                              <Calendar className="h-4 w-4" />
                              Opção 2: Estender Prazo
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-purple-700 mb-2">
                              Data estimada realista:
                            </p>
                            <p className="font-bold text-lg text-purple-900">
                              {formatDate(result.alternativeDate)}
                            </p>
                            <p className="text-xs text-purple-600 mt-1">
                              Com receita e gastos atuais
                            </p>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  </div>
                )}

                {/* Detalhamento */}
                <div className="bg-gray-50 border rounded-lg p-4">
                  <h4 className="font-semibold mb-3">📝 Detalhamento do Cálculo</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Receita mensal informada:</span>
                      <span className="font-medium">{formatCurrency(parseFloat(monthlyIncome.replace(',', '.')))}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Gastos mensais ({expenseType === 'budget' ? 'fixos' : 'reais'}):</span>
                      <span className="font-medium">-{formatCurrency(getMonthlyExpenses())}</span>
                    </div>
                    <Separator className="my-2" />
                    <div className="flex justify-between font-semibold">
                      <span>Sobra mensal para objetivo:</span>
                      <span className={result.monthlySavings > 0 ? 'text-green-600' : 'text-red-600'}>
                        {formatCurrency(result.monthlySavings)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>
                        {result.isViable && result.monthsToReachGoal && result.monthsToReachGoal < result.monthsRemaining
                          ? `Em ${result.monthsToReachGoal} meses (objetivo atingido):`
                          : `Em ${result.monthsRemaining} meses:`
                        }
                      </span>
                      <span className="font-medium">
                        {result.isViable && result.monthsToReachGoal && result.monthsToReachGoal < result.monthsRemaining
                          ? formatCurrency(goal.remainingAmount)
                          : formatCurrency(result.monthlySavings * result.monthsRemaining)
                        }
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Valor já acumulado:</span>
                      <span className="font-medium">+{formatCurrency(goal.currentAmount)}</span>
                    </div>
                    <Separator className="my-2" />
                    <div className="flex justify-between font-bold text-lg">
                      <span>Total projetado:</span>
                      <span className={result.isViable ? 'text-green-600' : 'text-red-600'}>
                        {formatCurrency(result.totalProjected)}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange?.(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
