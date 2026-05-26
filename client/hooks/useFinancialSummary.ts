import { useMemo } from 'react';
import { useFinancial } from '../contexts/FinancialContext';
import { useInvestments } from '../contexts/InvestmentContext';
import { FinancialSummary } from '@shared/financial-types';

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

  return useMemo(() => {
    const allocatedToGoals = getTotalAllocatedToGoals();
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Transações do mês atual
    const currentMonthTransactions = transactions.filter(t => {
      const transactionDate = new Date(t.date);
      return transactionDate.getMonth() === currentMonth && transactionDate.getFullYear() === currentYear;
    });

    // Receitas e despesas do mês
    const monthlyReceitas = currentMonthTransactions
      .filter(t => t.type === 'receita')
      .reduce((sum, t) => sum + t.amount, 0);

    const monthlyDespesas = currentMonthTransactions
      .filter(t => t.type === 'despesa')
      .reduce((sum, t) => sum + t.amount, 0);

    // Saldo do mês atual (apenas transações, sem investimentos de meses anteriores)
    const saldoMes = monthlyReceitas - monthlyDespesas;

    // Investimentos feitos no mês atual
    const investmentsThisMonth = investments.filter(inv => {
      const invDate = new Date(inv.purchaseDate);
      return invDate.getMonth() === currentMonth && invDate.getFullYear() === currentYear;
    });

    const investmentValueThisMonth = investmentsThisMonth.reduce((sum, inv) => sum + (inv.purchasePrice * inv.quantity), 0);

    // Saldo total respeitando filtros aplicados
    const filteredTransactions = getFilteredTransactions();
    const totalReceitas = filteredTransactions.filter(t => t.type === 'receita').reduce((sum, t) => sum + t.amount, 0);
    const totalDespesas = filteredTransactions.filter(t => t.type === 'despesa').reduce((sum, t) => sum + t.amount, 0);
    const saldoTotal = totalReceitas - totalDespesas;

    // Saldo com investimentos
    const saldoTotalComInvestimentos = saldoTotal + investmentSummary.currentValue;

    // Saldo total incluindo FGTS
    const totalWithFGTS = saldoTotalComInvestimentos + fgtsBalance;

    // Saldos disponíveis (descontando alocações para objetivos)
    const availableBalanceMonth = saldoMes - allocatedToGoals; // Apenas saldo mensal sem investimentos
    const availableBalanceTotal = saldoTotalComInvestimentos + fgtsBalance - allocatedToGoals;

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
  }, [transactionSummary, transactions, getFilteredTransactions, investmentSummary, getTotalAllocatedToGoals, investments, fgtsBalance]);
}
