import { useMemo, useState, useEffect } from 'react';
import { useFinancial } from '../contexts/FinancialContext';
import { useInvestments } from '../contexts/InvestmentContext';
import { FinancialSummary } from '@shared/financial-types';
import { PierreTransaction, PierreTransactionsResponse } from '@shared/pierre-types';
import { format, subMonths } from 'date-fns';

export function useFinancialSummary(): FinancialSummary & {
  investmentValue: number;
  allocatedToGoals: number;
  availableBalance: number;
  saldoMes: number;
  saldoTotal: number;
  availableBalanceMonth: number;
  availableBalanceTotal: number;
  fgtsBalance: number;
  totalWithFGTS: number;
  monthlyReceitas: number;
  monthlyDespesas: number;
  pierreReceitas: number;
  pierreDespesas: number;
  pierreTransactionCount: number;
} {
  const { summary: transactionSummary, transactions, getFilteredTransactions, fgtsBalance, filters } = useFinancial();
  const { summary: investmentSummary, getTotalAllocatedToGoals, investments } = useInvestments();

  const [pierreTransactions, setPierreTransactions] = useState<PierreTransaction[]>([]);

  // Fetch Pierre transactions - always fetch a larger window, filter locally
  useEffect(() => {
    const fetchPierreTransactions = async () => {
      try {
        const now = new Date();

        // Always fetch last 3 months to have enough data
        const startDate = subMonths(now, 3);
        const startDateStr = format(startDate, 'yyyy-MM-dd');
        const endDateStr = format(now, 'yyyy-MM-dd');

        const params = new URLSearchParams();
        params.append('startDate', startDateStr);
        params.append('endDate', endDateStr);
        params.append('format', 'raw');
        params.append('includeStatus', 'POSTED');

        console.log(`[useFinancialSummary] Fetching Pierre transactions for ${startDateStr} to ${endDateStr}`);

        const response = await fetch(`/api/pierre/transactions?${params.toString()}`);
        if (!response.ok) {
          console.error('[useFinancialSummary] Pierre API error response:', response.status, response.statusText);
          setPierreTransactions([]);
          return;
        }

        const data: PierreTransactionsResponse = await response.json();
        console.log('[useFinancialSummary] Pierre API response success:', data.success);
        console.log('[useFinancialSummary] Total transactions from API:', data.data?.length || 0);

        if (data.success && Array.isArray(data.data)) {
          setPierreTransactions(data.data);
        } else {
          console.warn('[useFinancialSummary] Pierre API returned unsuccessful response:', data);
          setPierreTransactions([]);
        }
      } catch (error) {
        console.error('[useFinancialSummary] Error fetching Pierre transactions:', error);
        setPierreTransactions([]);
      }
    };

    fetchPierreTransactions();
  }, []);

  return useMemo(() => {
    const allocatedToGoals = getTotalAllocatedToGoals();
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Obter transações filtradas (respeita os filtros de data)
    const filteredTransactions = getFilteredTransactions();

    // Filter Pierre transactions locally by the applied filters
    // This ensures the overview respects the selected date range
    const filteredPierreTransactions = pierreTransactions.filter(t => {
      const tDate = new Date(t.date);

      if (filters.startDate) {
        const startDate = new Date(filters.startDate);
        startDate.setHours(0, 0, 0, 0);
        if (tDate < startDate) return false;
      }

      if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59, 999);
        if (tDate > endDate) return false;
      }

      return true;
    });

    // Use ONLY Pierre transactions for the dashboard overview
    // Local transactions are ignored to match Pierre API data
    // Receitas = CREDIT transactions + CREDIT_CARD transactions
    const creditTransactions = filteredPierreTransactions.filter(t => t.type === 'CREDIT');
    const creditCardTransactions = filteredPierreTransactions.filter(t =>
      t.type === 'DEBIT' && t.account_subtype === 'CREDIT_CARD'
    );
    const creditAndCardTransactions = [...creditTransactions, ...creditCardTransactions];
    const monthlyReceitas = creditAndCardTransactions.reduce((sum, t) => sum + t.amount, 0);

    // Despesas = DEBIT transactions EXCEPT credit card
    const debitTransactions = filteredPierreTransactions.filter(t =>
      t.type === 'DEBIT' && t.account_subtype !== 'CREDIT_CARD'
    );
    const monthlyDespesas = debitTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);

    console.log('[useFinancialSummary] Filtered Pierre Transactions:', {
      totalPierreTransactions: pierreTransactions.length,
      totalFiltered: filteredPierreTransactions.length,
      credits: creditTransactions.length,
      creditCards: creditCardTransactions.length,
      totalReceitas: creditAndCardTransactions.length,
      debits: debitTransactions.length,
      creditSum: monthlyReceitas,
      debitSum: monthlyDespesas,
      dateRange: {
        startDate: filters.startDate,
        endDate: filters.endDate
      }
    });
    console.log('[useFinancialSummary] Sample Receitas Transactions (first 5):', creditAndCardTransactions.slice(0, 5).map(t => ({
      date: t.date,
      amount: t.amount,
      description: t.description,
      account_type: t.account_type,
      account_subtype: t.account_subtype,
      type: t.type
    })));

    // Saldo respeitando os filtros aplicados
    const saldoMes = monthlyReceitas - monthlyDespesas;

    // Investimentos respeitando filtros
    const investmentsFiltered = investments.filter(inv => {
      const invDate = new Date(inv.purchaseDate);
      if (filters.startDate && invDate < new Date(filters.startDate)) return false;
      if (filters.endDate && invDate > new Date(filters.endDate)) return false;
      return true;
    });

    const investmentValueThisMonth = investmentsFiltered.reduce((sum, inv) => sum + (inv.purchasePrice * inv.quantity), 0);

    // Saldo total = receitas - despesas (já calculados com filtros aplicados)
    const saldoTotal = monthlyReceitas - monthlyDespesas;

    // Saldo com investimentos filtrados
    const saldoTotalComInvestimentos = saldoTotal + investmentValueThisMonth;

    // Saldo total incluindo FGTS (FGTS é sempre incluso, não respeita filtros)
    const totalWithFGTS = saldoTotalComInvestimentos + fgtsBalance;

    // Saldos disponíveis (descontando alocações para objetivos)
    const availableBalanceMonth = saldoMes - allocatedToGoals;
    const availableBalanceTotal = totalWithFGTS - allocatedToGoals;

    // Pierre-only values for dashboard display (respects applied filters)
    const pierreReceitas = monthlyReceitas;
    const pierreDespesas = monthlyDespesas;

    console.log('[useFinancialSummary] Final Summary:', {
      pierreReceitas: pierreReceitas.toFixed(2),
      pierreDespesas: pierreDespesas.toFixed(2),
      pierreTransactionCount: filteredPierreTransactions.length,
      saldoMes: saldoMes.toFixed(2)
    });

    return {
      // Use Pierre data only, don't spread transactionSummary which includes local transactions
      totalReceitas: pierreReceitas,
      totalDespesas: pierreDespesas,
      saldoAtual: saldoTotalComInvestimentos,
      variacaoMensal: 0,
      maioresGastos: [],
      // Additional fields
      saldoMes,
      saldoTotal,
      investmentValue: investmentValueThisMonth,
      allocatedToGoals,
      availableBalance: availableBalanceTotal,
      availableBalanceMonth,
      availableBalanceTotal,
      fgtsBalance,
      totalWithFGTS,
      monthlyReceitas: pierreReceitas,
      monthlyDespesas: pierreDespesas,
      pierreReceitas,
      pierreDespesas,
      pierreTransactionCount: filteredPierreTransactions.length
    };
  }, [transactionSummary, transactions, getFilteredTransactions, investmentSummary, getTotalAllocatedToGoals, investments, fgtsBalance, pierreTransactions, filters]);
}
