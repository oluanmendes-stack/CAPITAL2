import { useState, useCallback } from 'react';
import { pierreFinanceService } from '../services/pierreFinanceService';
import { useFinancial } from '../contexts/FinancialContext';

export function usePierreCreditCardTransactions() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addTransaction } = useFinancial();

  const fetchAndIntegrateCreditCardTransactions = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const creditCardTransactions = await pierreFinanceService.getCreditCardTransactions();

      if (creditCardTransactions && creditCardTransactions.length > 0) {
        // Map credit card transactions to financial transactions
        for (const transaction of creditCardTransactions) {
          await addTransaction({
            type: 'despesa',
            category: 'cartao-credito', // Você pode criar essa categoria se não existir
            categoryName: 'Cartão de Crédito',
            description: `${transaction.accountName} - ${transaction.description}`,
            amount: transaction.amount,
            date: transaction.date,
            source: 'pierre',
            sourceDetails: {
              pierreId: transaction.id,
              accountId: transaction.accountId,
              accountName: transaction.accountName,
              status: transaction.status
            },
            tags: ['pierre', 'credito-card']
          });
        }
        setError(null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao buscar transações de cartão de crédito';
      setError(message);
      console.error('Erro ao buscar transações de cartão de crédito:', err);
    } finally {
      setLoading(false);
    }
  }, [addTransaction]);

  return {
    loading,
    error,
    fetchAndIntegrateCreditCardTransactions
  };
}
