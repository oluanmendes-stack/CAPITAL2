import { useState, useCallback } from 'react';
import { pierreFinanceService } from '../services/pierreFinanceService';
import { useFinancial } from '../contexts/FinancialContext';

export function usePierreAllTransactions() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addTransaction } = useFinancial();

  const fetchAndIntegrateAllTransactions = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch both bank and credit card transactions
      const [bankTransactions, creditCardTransactions] = await Promise.all([
        pierreFinanceService.getTransactions(),
        pierreFinanceService.getCreditCardTransactions()
      ]);

      const allTransactions = [
        ...(bankTransactions || []),
        ...(creditCardTransactions || [])
      ];

      if (allTransactions && allTransactions.length > 0) {
        for (const transaction of allTransactions) {
          try {
            // Map Pierre transactions to financial transactions
            const categoryMap: Record<string, string> = {
              'Alimentação': 'alimentacao',
              'Transporte': 'transporte',
              'Saúde': 'saude',
              'Educação': 'educacao',
              'Entretenimento': 'entretenimento',
              'Vestuário': 'vestuario',
              'Moradia': 'moradia',
              'Utilidades': 'utilidades',
              'Investimentos': 'investimentos',
              'default': 'outros'
            };

            const categoryId = categoryMap[transaction.category] || categoryMap['default'];

            await addTransaction({
              type: transaction.type === 'credit' ? 'receita' : 'despesa',
              category: categoryId,
              categoryName: transaction.category || 'Outros',
              description: transaction.description || transaction.merchantName || 'Transação Pierre',
              amount: transaction.amount,
              date: transaction.date,
              source: 'pierre',
              sourceDetails: {
                pierreId: transaction.id,
                accountId: transaction.accountId,
                accountName: transaction.accountName,
                provider: transaction.provider,
                externalId: transaction.externalId
              },
              tags: ['pierre', transaction.type === 'credit' ? 'receita' : 'despesa']
            });
          } catch (txError) {
            // Continue with next transaction if one fails
            console.error('Error adding Pierre transaction:', txError);
          }
        }
        setError(null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao buscar transações do Pierre';
      setError(message);
      console.error('Erro ao buscar transações do Pierre:', err);
    } finally {
      setLoading(false);
    }
  }, [addTransaction]);

  return {
    loading,
    error,
    fetchAndIntegrateAllTransactions
  };
}
