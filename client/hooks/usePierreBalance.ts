import { useState, useEffect, useCallback } from 'react';
import { pierreFinanceService } from '../services/pierreFinanceService';
import { PierreConsolidatedBalance } from '@shared/pierre-types';

export function usePierreBalance() {
  const [consolidatedBalance, setConsolidatedBalance] = useState<PierreConsolidatedBalance | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadBalance = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const balance = await pierreFinanceService.getConsolidatedBalance();
      setConsolidatedBalance(balance);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar saldo');
      setConsolidatedBalance(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Carregar saldo inicialmente
  useEffect(() => {
    loadBalance();
  }, [loadBalance]);

  return {
    consolidatedBalance,
    isLoading,
    error,
    refresh: loadBalance
  };
}
