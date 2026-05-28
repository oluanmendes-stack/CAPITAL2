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

  // Fetch Pierre transactions for current month
  useEffect(() => {
    const fetchPierreTransactions = async () => {
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
        if (!response.ok) {
          console.error('Pierre API error response:', response.status, response.statusText);
          setPierreTransactions([]);
          return;
        }

        const data: PierreTransactionsResponse = await response.json();
        console.log('Pierre API response:', data);

        if (data.success && data.data) {
          const transactions = Array.isArray(data.data) ? data.data : [];
          // Pierre API should already filter by dates, but double-check to ensure only current month
          const currentMonthTransactions = transactions.filter(t => {
            try {
              const tDate = new Date(t.date);
              const tMonth = tDate.getMonth();
              const tYear = tDate.getFullYear();
              const currentMonth = now.getMonth();
              const currentYear = now.getFullYear();
              return tMonth === currentMonth && tYear === currentYear;
            } catch {
              return false;
            }
          });
          console.log('Filtered Pierre transactions:', currentMonthTransactions);
          setPierreTransactions(currentMonthTransactions);
        } else {
          console.warn('Pierre API returned unsuccessful response:', data);
          setPierreTransactions([]);
        }
      } catch (error) {
        console.error('Error fetching Pierre transactions:', error);
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

    // Pierre transactions already filtered in useEffect to current month
    // This ensures the "Saldo Mês Atual" always shows current month data
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

    // Pierre-only values for dashboard display (always current month)
    const pierreReceitas = monthlyReceitas;
    const pierreDespesas = monthlyDespesas;

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
