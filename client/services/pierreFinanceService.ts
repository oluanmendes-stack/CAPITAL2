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

const PIERRE_API_BASE = 'https://www.pierre.finance';

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
    const url = this.useServerProxy ? '/api/pierre/accounts' : `${PIERRE_API_BASE}/tools/api/get-accounts`;
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
    categories?: string[],
    minAmount?: number,
    maxAmount?: number,
    accountType?: string,
    accountSubtype?: string
  ): Promise<OpenFinanceTransaction[]> {
    const params = new URLSearchParams();

    // Default to 90 days if no dates provided
    if (!startDate || !endDate) {
      const now = new Date();
      const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

      if (!startDate) params.append('startDate', threeMonthsAgo.toISOString().split('T')[0]);
      if (!endDate) params.append('endDate', now.toISOString().split('T')[0]);
    } else {
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
    }

    if (categories?.length) params.append('categories', categories.join(','));
    if (minAmount !== undefined) params.append('minAmount', String(minAmount));
    if (maxAmount !== undefined) params.append('maxAmount', String(maxAmount));
    if (accountType) params.append('accountType', accountType);
    if (accountSubtype) params.append('accountSubtype', accountSubtype);
    params.append('format', 'raw');
    // Only include POSTED transactions, exclude PENDING
    params.append('includeStatus', 'POSTED');

    const url = this.useServerProxy
      ? `/api/pierre/transactions?${params.toString()}`
      : `${PIERRE_API_BASE}/tools/api/get-transactions?${params.toString()}`;

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

    return (Array.isArray(data.data) ? data.data : []).map(transaction => this.mapPierreTransaction(transaction));
  }

  async getBalances(): Promise<PierreBalance[]> {
    const url = this.useServerProxy ? '/api/pierre/balance' : `${PIERRE_API_BASE}/tools/api/get-balance`;
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
        `Failed to fetch balances from Pierre: ${error.error || response.statusText}`
      );
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error('Pierre API returned unsuccessful response');
    }

    // Map accounts from balance response
    return (data.data.accounts || []).map((account: any) => ({
      accountId: account.id || account.accountId,
      accountName: account.name || account.accountName,
      accountType: account.type || 'checking',
      balance: account.balance || 0,
      availableBalance: account.availableBalance || account.balance || 0,
      currencyCode: account.currencyCode || 'BRL',
      lastUpdate: account.lastUpdate || new Date().toISOString(),
      bankName: account.provider || account.bankName || ''
    }));
  }

  async getConsolidatedBalance(): Promise<PierreConsolidatedBalance> {
    const url = this.useServerProxy ? '/api/pierre/balance' : `${PIERRE_API_BASE}/tools/api/get-balance`;
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
        `Failed to fetch consolidated balance from Pierre: ${error.error || response.statusText}`
      );
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error('Pierre API returned unsuccessful response');
    }

    const balanceData = data.data;
    const balances = await this.getBalances();

    const balancesByType = {
      checking: 0,
      savings: 0,
      credit_card: 0,
      investment: 0
    };

    const balancesByProvider: Record<string, number> = {};

    balances.forEach(balance => {
      const amount = balance.balance || 0;
      const accountType = balance.accountType as keyof typeof balancesByType;
      if (accountType in balancesByType) {
        balancesByType[accountType] += amount;
      }

      const provider = balance.bankName || 'unknown';
      if (!balancesByProvider[provider]) {
        balancesByProvider[provider] = 0;
      }
      balancesByProvider[provider] += amount;
    });

    return {
      totalBalance: balanceData.total_balance || 0,
      totalAvailableBalance: balanceData.total_balance || 0,
      currencyCode: 'BRL',
      balancesByType,
      balancesByProvider,
      lastUpdate: balanceData.timestamp || new Date().toISOString()
    };
  }

  async getBills(accountId?: string) {
    const params = new URLSearchParams();
    if (accountId) params.append('accountId', accountId);

    const url = this.useServerProxy
      ? `/api/pierre/bills${params.toString() ? '?' + params.toString() : ''}`
      : `${PIERRE_API_BASE}/tools/api/get-bills${params.toString() ? '?' + params.toString() : ''}`;

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
        `Failed to fetch bills from Pierre: ${error.error || response.statusText}`
      );
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error('Pierre API returned unsuccessful response');
    }
    return data;
  }

  async getBillSummary(accountId?: string, closingDay?: number) {
    const params = new URLSearchParams();
    if (accountId) params.append('accountId', accountId);
    if (closingDay) params.append('closingDay', String(closingDay));

    const url = this.useServerProxy
      ? `/api/pierre/bill-summary${params.toString() ? '?' + params.toString() : ''}`
      : `${PIERRE_API_BASE}/tools/api/get-bill-summary${params.toString() ? '?' + params.toString() : ''}`;

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
        `Failed to fetch bill summary from Pierre: ${error.error || response.statusText}`
      );
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error('Pierre API returned unsuccessful response');
    }
    return data;
  }

  async getInstallments() {
    const url = this.useServerProxy
      ? '/api/pierre/installments'
      : `${PIERRE_API_BASE}/tools/api/get-installments`;

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

  async getCreditCardTransactions() {
    try {
      const billsData = await this.getBills();
      const transactions = [];

      if (billsData.data && Array.isArray(billsData.data)) {
        billsData.data.forEach((bill: any) => {
          if (bill.transactions && Array.isArray(bill.transactions)) {
            bill.transactions.forEach((transaction: any) => {
              transactions.push({
                id: transaction.id,
                accountId: bill.accountId,
                accountName: bill.accountName,
                provider: 'pierre',
                date: transaction.date,
                description: transaction.description,
                amount: Math.abs(transaction.amount || 0),
                type: transaction.type === 'CREDIT' ? 'credit' : 'debit',
                category: transaction.category,
                merchantName: transaction.description,
                externalId: transaction.id,
                status: transaction.status
              });
            });
          }
        });
      }

      return transactions;
    } catch (error) {
      console.error('Error fetching credit card transactions:', error);
      return [];
    }
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
