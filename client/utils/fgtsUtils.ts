import { Transaction } from '@shared/financial-types';

export interface FGTSEarning {
  date: string;
  amount: number;
  rate: number; // percentage
}

export interface FGTSProjection {
  currentBalance: number;
  estimatedRate: number; // annual percentage
  projections: Array<{
    month: number;
    balance: number;
    earnings: number;
  }>;
  monthlyAvgEarning: number;
}

/**
 * Detects if a transaction is related to FGTS earnings/interest
 */
export function isFGTSEarning(transaction: Transaction): boolean {
  const keywords = [
    'fgts',
    'rendimento',
    'rendering',
    'juros',
    'interest',
    'yield',
    'earnings',
    'acréscimo',
    'correção',
    'atualização monetária'
  ];

  const description = transaction.description.toLowerCase();
  const categoryName = transaction.categoryName?.toLowerCase() || '';
  const tags = (transaction.tags || []).map(t => t.toLowerCase());

  const allText = `${description} ${categoryName} ${tags.join(' ')}`;

  return keywords.some(keyword => allText.includes(keyword));
}

/**
 * Calculates FGTS earnings from a list of transactions
 */
export function getFGTSEarnings(transactions: Transaction[]): FGTSEarning[] {
  return transactions
    .filter(isFGTSEarning)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map(transaction => ({
      date: transaction.date,
      amount: transaction.amount,
      rate: 0 // Will be calculated relative to previous balance if available
    }));
}

/**
 * Calculates the estimated annual FGTS earnings rate based on historical earnings
 */
export function calculateFGTSRate(
  fgtsBalance: number,
  earnings: FGTSEarning[],
  numberOfMonths: number = 12
): number {
  if (earnings.length === 0 || fgtsBalance === 0) {
    return 0;
  }

  const totalEarnings = earnings.reduce((sum, e) => sum + e.amount, 0);
  const months = Math.max(numberOfMonths, Math.max(1, earnings.length)); // Use actual number of months or provided default

  const monthlyRate = (totalEarnings / fgtsBalance) / months;
  const annualRate = monthlyRate * 12;

  return Math.max(0, annualRate); // Ensure non-negative
}

/**
 * Projects FGTS balance growth based on detected earnings rate
 */
export function projectFGTSGrowth(
  currentBalance: number,
  annualRate: number,
  months: number = 12
): FGTSProjection {
  const monthlyRate = annualRate / 12;
  const projections: FGTSProjection['projections'] = [];

  let balance = currentBalance;
  let totalEarnings = 0;

  for (let month = 1; month <= months; month++) {
    const earnings = balance * monthlyRate;
    balance += earnings;
    totalEarnings += earnings;

    projections.push({
      month,
      balance: Math.round(balance * 100) / 100, // Round to 2 decimal places
      earnings: Math.round(earnings * 100) / 100
    });
  }

  const monthlyAvgEarning = totalEarnings / months;

  return {
    currentBalance,
    estimatedRate: annualRate,
    projections,
    monthlyAvgEarning: Math.round(monthlyAvgEarning * 100) / 100
  };
}

/**
 * Formats FGTS projection for display
 */
export function formatFGTSProjection(projection: FGTSProjection): string {
  const formatter = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });

  const percentFormatter = new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  const lines = [
    `Taxa Estimada: ${percentFormatter.format(projection.estimatedRate)}`,
    `Rendimento Médio Mensal: ${formatter.format(projection.monthlyAvgEarning)}`,
    `Saldo Projetado em ${projection.projections.length} meses: ${formatter.format(projection.projections[projection.projections.length - 1].balance)}`
  ];

  return lines.join('\n');
}

/**
 * Detects if there are recent FGTS transactions suggesting active earnings
 */
export function hasActiveFGTSEarnings(
  transactions: Transaction[],
  daysBack: number = 365
): boolean {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);

  const recentFGTSTransactions = transactions.filter(tx => {
    const txDate = new Date(tx.date);
    return txDate > cutoffDate && isFGTSEarning(tx);
  });

  return recentFGTSTransactions.length > 0;
}
