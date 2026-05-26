import { useMemo } from 'react';
import { useFinancial } from '../contexts/FinancialContext';
import {
  isFGTSEarning,
  getFGTSEarnings,
  calculateFGTSRate,
  projectFGTSGrowth,
  hasActiveFGTSEarnings,
  FGTSEarning,
  FGTSProjection
} from '../utils/fgtsUtils';

export interface FGTSAnalysis {
  earnings: FGTSEarning[];
  estimatedAnnualRate: number;
  estimatedMonthlyRate: number;
  hasActiveEarnings: boolean;
  projection12Months: FGTSProjection;
  totalHistoricalEarnings: number;
  lastEarningDate?: string;
}

export function useFGTSAnalysis(): FGTSAnalysis {
  const { transactions, fgtsBalance } = useFinancial();

  return useMemo(() => {
    const earnings = getFGTSEarnings(transactions);
    const hasActive = hasActiveFGTSEarnings(transactions);
    const estimatedAnnualRate = calculateFGTSRate(
      fgtsBalance,
      earnings,
      Math.max(1, earnings.length > 0 ? transactions.length / 30 : 12) // Estimate months from transaction count
    );
    const estimatedMonthlyRate = estimatedAnnualRate / 12;
    const projection12Months = projectFGTSGrowth(fgtsBalance, estimatedAnnualRate, 12);
    const totalHistoricalEarnings = earnings.reduce((sum, e) => sum + e.amount, 0);
    const lastEarningDate = earnings.length > 0 ? earnings[earnings.length - 1].date : undefined;

    return {
      earnings,
      estimatedAnnualRate,
      estimatedMonthlyRate,
      hasActiveEarnings: hasActive,
      projection12Months,
      totalHistoricalEarnings,
      lastEarningDate
    };
  }, [transactions, fgtsBalance]);
}
