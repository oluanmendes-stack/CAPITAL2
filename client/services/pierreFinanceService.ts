import { OpenFinanceAccount, OpenFinanceTransaction } from '@shared/open-finance-types';

const PIERRE_API_BASE = 'https://www.pierre.finance/tools/api';

interface PierreAccount {
  accountId: string;
  providerCode: string;
  accountName: string;
  accountType: string;
  accountSubtype: string;
  accountBalance: number;
  accountCurrencyCode: string;
  accountMarketingName: string;
  bankData?: {
    transferNumber?: string;
    closingBalance?: number;
    automaticallyInvestedBalance?: number;
  };
  creditData?: {
    brand?: string;
    level?: string;
    status?: string;
    creditLimit?: number;
    balanceDueDate?: string;
    minimumPayment?: number;
    balanceCloseDate?: string;
    availableCreditLimit?: number;
    balanceForeignCurrency?: number | null;
  };
}

interface PierreTransaction {
  id: string;
  description: string;
  category: string | null;
  currency_code: string;
  amount: number;
  balance: number | null;
  date: string;
  type: 'DEBIT' | 'CREDIT';
  status: 'POSTED' | 'PENDING';
  account_name: string;
  account_type: string;
  account_subtype: string;
  account_marketing_name: string;
}

interface PierreAccountsResponse {
  success: boolean;
  data: PierreAccount[];
  count: number;
  timestamp: string;
}

interface PierreTransactionsResponse {
  success: boolean;
  data: PierreTransaction[];
  count: number;
  filters: Record<string, unknown>;
  timestamp: string;
  totalBeforeFilter?: number | null;
  clientMessageUsed?: string | null;
  message?: string;
}

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
