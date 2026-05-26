// Tipos para integração com API Pierre Finance

export interface PierreBalance {
  accountId: string;
  accountName: string;
  accountType: 'checking' | 'savings' | 'credit_card' | 'investment';
  balance: number;
  availableBalance?: number;
  currencyCode: string;
  lastUpdate: string;
}

export interface PierreConsolidatedBalance {
  totalBalance: number;
  totalAvailableBalance?: number;
  currencyCode: string;
  balancesByType: {
    checking: number;
    savings: number;
    credit_card: number;
    investment: number;
  };
  balancesByProvider: Record<string, number>;
  lastUpdate: string;
}

// API Pierre - Installments Response
export interface PierreInstallment {
  description: string;
  amount: number;
  installmentNumber: number;
  totalInstallments: number;
  dueDate: string;
  category: string | null;
  status: 'POSTED' | 'PENDING' | 'OVERDUE' | 'CANCELLED';
}

export interface PierreInstallmentPurchase {
  purchaseDate: string;
  totalAmount: number;
  installments: PierreInstallment[];
}

export interface PierreInstallmentSummary {
  totalAmount: number;
  totalInstallments: number;
  totalPurchases: number;
  installmentDistribution: Array<{
    totalInstallments: number;
    count: number;
    totalAmount: number;
  }>;
}

export interface PierreInstallmentsResponse {
  success: boolean;
  data: {
    summary: PierreInstallmentSummary;
    purchases: PierreInstallmentPurchase[];
    dateRange: {
      startDate: string;
      endDate: string;
    };
    timestamp: string;
  };
  summary: PierreInstallmentSummary;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  timestamp: string;
}

export interface PierreAccount {
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

export interface PierreTransaction {
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

export interface PierreAccountsResponse {
  success: boolean;
  data: PierreAccount[];
  count: number;
  timestamp: string;
}

export interface PierreTransactionsResponse {
  success: boolean;
  data: PierreTransaction[];
  count: number;
  filters: Record<string, unknown>;
  timestamp: string;
  totalBeforeFilter?: number | null;
  clientMessageUsed?: string | null;
  message?: string;
}

export interface PierreSyncResult {
  timestamp: string;
  accountsCount: number;
  transactionsImported: number;
  installmentsFound: number;
  errors: string[];
}
