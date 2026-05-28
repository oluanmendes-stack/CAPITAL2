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

  // Fetch Pierre transactions respecting the applied filters
  useEffect(() => {
    const fetchPierreTransactions = async () => {
      try {
        const now = new Date();

        // Determine the date range to fetch
        let startDateStr: string;
        let endDateStr: string;

        if (filters.startDate && filters.endDate) {
          // Use the applied filters
          startDateStr = filters.startDate;
          endDateStr = filters.endDate;
        } else {
          // Default to current month
          const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
          const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          startDateStr = format(firstDay, 'yyyy-MM-dd');
          endDateStr = format(lastDay, 'yyyy-MM-dd');
        }

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
          const transactions = data.data;

          // Separate by type before filtering
          const creditsBeforeFilter = transactions.filter(t => t.type === 'CREDIT');
          const debitsBeforeFilter = transactions.filter(t => t.type === 'DEBIT');
          const creditsSumBeforeFilter = creditsBeforeFilter.reduce((sum, t) => sum + t.amount, 0);
          const debitsSumBeforeFilter = debitsBeforeFilter.reduce((sum, t) => sum + t.amount, 0);

          console.log('[useFinancialSummary] Before date filter:', {
            total: transactions.length,
            credits: creditsBeforeFilter.length,
            creditsSum: creditsSumBeforeFilter,
            debits: debitsBeforeFilter.length,
            debitsSum: debitsSumBeforeFilter
          });

          // Filter transactions by the date range
          const filteredByDate = transactions.filter(t => {
            try {
              const tDate = new Date(t.date);
              const startDate = new Date(startDateStr);
              const endDate = new Date(endDateStr);
              return tDate >= startDate && tDate <= endDate;
            } catch {
              return false;
            }
          });

          const creditsAfterFilter = filteredByDate.filter(t => t.type === 'CREDIT');
          const debitsAfterFilter = filteredByDate.filter(t => t.type === 'DEBIT');
          const creditsSumAfterFilter = creditsAfterFilter.reduce((sum, t) => sum + t.amount, 0);
          const debitsSumAfterFilter = debitsAfterFilter.reduce((sum, t) => sum + Math.abs(t.amount), 0);

          console.log('[useFinancialSummary] After date filter:', {
            total: filteredByDate.length,
            credits: creditsAfterFilter.length,
            creditsSum: creditsSumAfterFilter,
            debits: debitsAfterFilter.length,
            debitsSum: debitsSumAfterFilter
          });

          setPierreTransactions(filteredByDate);
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
  }, [filters]);

  return useMemo(() => {
    const allocatedToGoals = getTotalAllocatedToGoals();
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Obter transações filtradas (respeita os filtros de data)
    const filteredTransactions = getFilteredTransactions();

    // Pierre transactions are already filtered by the applied date filters
    // This ensures the overview respects the selected date range
    const filteredPierreTransactions = pierreTransactions;

    // Use ONLY Pierre transactions for the dashboard overview
    // Local transactions are ignored to match Pierre API data
    const monthlyReceitas = filteredPierreTransactions
      .filter(t => t.type === 'CREDIT')
      .reduce((sum, t) => sum + t.amount, 0);

    const monthlyDespesas = filteredPierreTransactions
      .filter(t => t.type === 'DEBIT')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

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
