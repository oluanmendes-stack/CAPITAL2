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
} {
  const { summary: transactionSummary, transactions, getFilteredTransactions, fgtsBalance } = useFinancial();
  const { summary: investmentSummary, getTotalAllocatedToGoals, investments } = useInvestments();

  const [pierreTransactions, setPierreTransactions] = useState<PierreTransaction[]>([]);

  // Fetch Pierre transactions
  useEffect(() => {
    const fetchPierreTransactions = async () => {
      try {
        const startDate = subMonths(new Date(), 3);
        const params = new URLSearchParams();
        params.append('startDate', format(startDate, 'yyyy-MM-dd'));
        params.append('endDate', format(new Date(), 'yyyy-MM-dd'));
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

    // Transações do mês atual (regulares)
    const currentMonthTransactions = transactions.filter(t => {
      const transactionDate = new Date(t.date);
      return transactionDate.getMonth() === currentMonth && transactionDate.getFullYear() === currentYear;
    });

    // Transações do Pierre do mês atual
    const currentMonthPierreTransactions = pierreTransactions.filter(t => {
      const transactionDate = new Date(t.date);
      return transactionDate.getMonth() === currentMonth && transactionDate.getFullYear() === currentYear;
    });

    // Receitas e despesas do mês (incluindo Pierre)
    const monthlyReceitas = currentMonthTransactions
      .filter(t => t.type === 'receita')
      .reduce((sum, t) => sum + t.amount, 0) +
      currentMonthPierreTransactions
        .filter(t => t.type === 'CREDIT')
        .reduce((sum, t) => sum + t.amount, 0);

    const monthlyDespesas = currentMonthTransactions
      .filter(t => t.type === 'despesa')
      .reduce((sum, t) => sum + t.amount, 0) +
      currentMonthPierreTransactions
        .filter(t => t.type === 'DEBIT')
        .reduce((sum, t) => sum + t.amount, 0);

    // Saldo do mês atual (apenas transações, sem investimentos de meses anteriores)
    const saldoMes = monthlyReceitas - monthlyDespesas;

    // Investimentos feitos no mês atual
    const investmentsThisMonth = investments.filter(inv => {
      const invDate = new Date(inv.purchaseDate);
      return invDate.getMonth() === currentMonth && invDate.getFullYear() === currentYear;
    });

    const investmentValueThisMonth = investmentsThisMonth.reduce((sum, inv) => sum + (inv.purchasePrice * inv.quantity), 0);

    // Saldo total respeitando filtros aplicados (incluindo Pierre)
    const filteredTransactions = getFilteredTransactions();
    const totalReceitas = filteredTransactions.filter(t => t.type === 'receita').reduce((sum, t) => sum + t.amount, 0) +
      pierreTransactions
        .filter(t => t.type === 'CREDIT')
        .reduce((sum, t) => sum + t.amount, 0);
    const totalDespesas = filteredTransactions.filter(t => t.type === 'despesa').reduce((sum, t) => sum + t.amount, 0) +
      pierreTransactions
        .filter(t => t.type === 'DEBIT')
        .reduce((sum, t) => sum + t.amount, 0);
    const saldoTotal = totalReceitas - totalDespesas;

    // Saldo com investimentos
    const saldoTotalComInvestimentos = saldoTotal + investmentSummary.currentValue;

    // Saldo total incluindo FGTS
    const totalWithFGTS = saldoTotalComInvestimentos + fgtsBalance;

    // Saldos disponíveis (descontando alocações para objetivos)
    const availableBalanceMonth = saldoMes - allocatedToGoals; // Apenas saldo mensal sem investimentos
    const availableBalanceTotal = totalWithFGTS - allocatedToGoals;

    return {
      ...transactionSummary,
      saldoAtual: saldoTotalComInvestimentos, // Mantém compatibilidade
      saldoMes,
      saldoTotal,
      investmentValue: investmentSummary.currentValue,
      allocatedToGoals,
      availableBalance: availableBalanceTotal, // Mantém compatibilidade
      availableBalanceMonth,
      availableBalanceTotal,
      fgtsBalance,
      totalWithFGTS,
      monthlyReceitas,
      monthlyDespesas
    };
  }, [transactionSummary, transactions, getFilteredTransactions, investmentSummary, getTotalAllocatedToGoals, investments, fgtsBalance, pierreTransactions]);
}
