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

        const response = await fetch(`/api/pierre/transactions?${params.toString()}`);
        if (response.ok) {
          const data: PierreTransactionsResponse = await response.json();
          if (data.success) {
            setPierreTransactions(data.data || []);
          }
        }
      } catch (error) {
        console.error('Error fetching Pierre transactions:', error);
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

    // Pierre transactions: ALWAYS use current month, ignore custom filters
    // This ensures the "Saldo Mês Atual" always shows current month data
    let filteredPierreTransactions = pierreTransactions.filter(t => {
      const transactionDate = new Date(t.date);
      return transactionDate.getMonth() === currentMonth &&
             transactionDate.getFullYear() === currentYear;
    });

    // Receitas e despesas respeitando os filtros aplicados (incluindo Pierre)
    const monthlyReceitas = filteredTransactions
      .filter(t => t.type === 'receita')
      .reduce((sum, t) => sum + t.amount, 0) +
      filteredPierreTransactions
        .filter(t => t.type === 'CREDIT')
        .reduce((sum, t) => sum + t.amount, 0);

    const monthlyDespesas = filteredTransactions
      .filter(t => t.type === 'despesa')
      .reduce((sum, t) => sum + t.amount, 0) +
      filteredPierreTransactions
        .filter(t => t.type === 'DEBIT')
        .reduce((sum, t) => sum + t.amount, 0);

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

    // Pierre-only values for dashboard display
    const pierreReceitas = filteredPierreTransactions
      .filter(t => t.type === 'CREDIT')
      .reduce((sum, t) => sum + t.amount, 0);

    const pierreDespesas = filteredPierreTransactions
      .filter(t => t.type === 'DEBIT')
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      ...transactionSummary,
      saldoAtual: saldoTotalComInvestimentos,
      saldoMes,
      saldoTotal,
      investmentValue: investmentValueThisMonth,
      allocatedToGoals,
      availableBalance: availableBalanceTotal,
      availableBalanceMonth,
      availableBalanceTotal,
      fgtsBalance,
      totalWithFGTS,
      monthlyReceitas,
      monthlyDespesas,
      pierreReceitas,
      pierreDespesas,
      pierceTransactionCount: filteredPierreTransactions.length
    };
  }, [transactionSummary, transactions, getFilteredTransactions, investmentSummary, getTotalAllocatedToGoals, investments, fgtsBalance, pierreTransactions, filters]);
}
