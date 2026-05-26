import { OpenFinanceAccount, OpenFinanceTransaction } from '@shared/open-finance-types';
import {
  PierreAccountsResponse,
  PierreTransactionsResponse,
  PierreBalance,
  PierreConsolidatedBalance,
  PierreSyncResult,
  PierreAccount,
  PierreTransaction
} from '@shared/pierre-types';

const PIERRE_API_BASE = 'https://www.pierre.finance/tools/api';

class PierreFinanceService {
  private apiKey: string;
  private useServerProxy: boolean;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || (import.meta.env.VITE_PIERRE_API_KEY as string) || '';
    // Use server proxy to keep API key secure
    this.useServerProxy = true;
  }

  setApiKey(apiKey: string) {
    this.apiKey = apiKey;
  }

  private getHeaders() {
    return {
      'Content-Type': 'application/json'
    };
  }

  async getAccounts(): Promise<OpenFinanceAccount[]> {
    const url = this.useServerProxy ? '/api/pierre/accounts' : `${PIERRE_API_BASE}/get-accounts`;
    const headers = this.useServerProxy ? this.getHeaders() : {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };

    const response = await fetch(url, {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        `Failed to fetch accounts from Pierre: ${error.error || response.statusText}`
      );
    }

    const data: PierreAccountsResponse = await response.json();

    if (!data.success) {
      throw new Error('Pierre API returned unsuccessful response');
    }

    return data.data.map(account => this.mapPierreAccount(account));
  }

  async getTransactions(
    startDate?: string,
    endDate?: string,
    categories?: string[]
  ): Promise<OpenFinanceTransaction[]> {
    const params = new URLSearchParams();

    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (categories?.length) params.append('categories', categories.join(','));
    params.append('format', 'raw');

    const url = this.useServerProxy
      ? `/api/pierre/transactions?${params.toString()}`
      : `${PIERRE_API_BASE}/get-transactions?${params.toString()}`;

    const headers = this.useServerProxy ? this.getHeaders() : {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };

    const response = await fetch(url, {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        `Failed to fetch transactions from Pierre: ${error.error || response.statusText}`
      );
    }

    const data: PierreTransactionsResponse = await response.json();

    if (!data.success) {
      throw new Error('Pierre API returned unsuccessful response');
    }

    return data.data.map(transaction => this.mapPierreTransaction(transaction));
  }

  async getBalances(): Promise<PierreBalance[]> {
    const accounts = await this.getAccounts();
    return accounts.map(account => {
      const balance = account.balance ?? 0;
      return {
        accountId: account.id,
        accountName: account.name,
        accountType: account.type,
        balance: balance,
        availableBalance: balance,
        currencyCode: account.currency,
        lastUpdate: account.lastUpdate,
        bankName: account.provider
      };
    });
  }

  async getConsolidatedBalance(): Promise<PierreConsolidatedBalance> {
    const balances = await this.getBalances();

    const balancesByType = {
      checking: 0,
      savings: 0,
      credit_card: 0,
      investment: 0
    };

    const balancesByProvider: Record<string, number> = {};
    let totalBalance = 0;

    balances.forEach(balance => {
      const amount = balance.balance || 0;
      totalBalance += amount;
      balancesByType[balance.accountType] = (balancesByType[balance.accountType] || 0) + amount;
    });

    const accounts = await this.getAccounts();
    accounts.forEach(account => {
      const provider = account.provider;
      if (!balancesByProvider[provider]) {
        balancesByProvider[provider] = 0;
      }
      balancesByProvider[provider] += account.balance;
    });

    return {
      totalBalance,
      totalAvailableBalance: totalBalance,
      currencyCode: 'BRL',
      balancesByType,
      balancesByProvider,
      lastUpdate: new Date().toISOString()
    };
  }

  async getInstallments() {
    const url = this.useServerProxy
      ? '/api/pierre/installments'
      : `${PIERRE_API_BASE}/get-installments`;

    const headers = this.useServerProxy ? this.getHeaders() : {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };

    const response = await fetch(url, {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        `Failed to fetch installments from Pierre: ${error.error || response.statusText}`
      );
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error('Pierre API returned unsuccessful response');
    }
    return data;
  }

  async syncData(): Promise<PierreSyncResult> {
    try {
      const accounts = await this.getAccounts();
      const transactions = await this.getTransactions();
      const installmentsResponse = await this.getInstallments();

      const installmentsCount = installmentsResponse?.data?.summary?.totalInstallments || 0;

      return {
        timestamp: new Date().toISOString(),
        accountsCount: accounts.length,
        transactionsImported: transactions.length,
        installmentsFound: installmentsCount,
        errors: []
      };
    } catch (error) {
      return {
        timestamp: new Date().toISOString(),
        accountsCount: 0,
        transactionsImported: 0,
        installmentsFound: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error occurred']
      };
    }
  }

  private mapPierreAccount(account: PierreAccount): OpenFinanceAccount {
    let type: OpenFinanceAccount['type'] = 'checking';

    if (account.accountType === 'CREDIT') {
      type = 'credit_card';
    } else if (account.accountSubtype?.includes('SAVINGS')) {
      type = 'savings';
    } else if (account.accountType === 'INVESTMENT') {
      type = 'investment';
    }

    return {
      id: account.accountId,
      provider: 'pierre',
      type,
      name: account.accountMarketingName || account.accountName,
      number: account.bankData?.transferNumber || '**** ****',
      balance: account.accountBalance,
      currency: account.accountCurrencyCode || 'BRL',
      lastUpdate: new Date().toISOString()
    };
  }

  private mapPierreTransaction(transaction: PierreTransaction): OpenFinanceTransaction {
    return {
      id: transaction.id,
      accountId: transaction.account_marketing_name,
      provider: 'pierre',
      date: transaction.date,
      description: transaction.description,
      amount: Math.abs(transaction.amount),
      type: transaction.type === 'CREDIT' ? 'credit' : 'debit',
      category: transaction.category || undefined,
      merchantName: transaction.description,
      externalId: transaction.id
    };
  }
}

export const pierreFinanceService = new PierreFinanceService();
