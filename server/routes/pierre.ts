import { RequestHandler } from 'express';

const PIERRE_API_BASE = 'https://www.pierre.finance';

interface PierreProxyRequest {
  endpoint: 'accounts' | 'transactions';
  params?: Record<string, string>;
}

export const handlePierreProxy: RequestHandler = async (req, res) => {
  try {
    const { endpoint, params } = req.body as PierreProxyRequest;

    if (!endpoint) {
      return res.status(400).json({ error: 'Missing endpoint parameter' });
    }

    const apiKey = process.env.VITE_PIERRE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Pierre API key not configured' });
    }

    // Build query string if params provided
    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    const url = `${PIERRE_API_BASE}/tools/api/get-${endpoint}${queryString}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        error: 'Pierre API error',
        details: errorData
      });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error proxying to Pierre API:', error);
    res.status(500).json({
      error: 'Failed to fetch from Pierre API',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const getPierreAccounts: RequestHandler = async (req, res) => {
  try {
    const apiKey = process.env.VITE_PIERRE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Pierre API key not configured' });
    }

    const response = await fetch(`${PIERRE_API_BASE}/tools/api/get-accounts`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        error: 'Failed to fetch accounts',
        details: errorData
      });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error fetching Pierre accounts:', error);
    res.status(500).json({
      error: 'Failed to fetch accounts',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const getPierreTransactions: RequestHandler = async (req, res) => {
  try {
    const apiKey = process.env.VITE_PIERRE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Pierre API key not configured' });
    }

    const {
      startDate,
      endDate,
      categories,
      format = 'raw',
      minAmount,
      maxAmount,
      accountType,
      accountSubtype,
      includeStatus,
      clientMessage
    } = req.query;

    const params = new URLSearchParams();
    if (startDate) params.append('startDate', String(startDate));
    if (endDate) params.append('endDate', String(endDate));
    if (categories) params.append('categories', String(categories));
    if (minAmount) params.append('minAmount', String(minAmount));
    if (maxAmount) params.append('maxAmount', String(maxAmount));
    if (accountType) params.append('accountType', String(accountType));
    if (accountSubtype) params.append('accountSubtype', String(accountSubtype));
    if (includeStatus) params.append('includeStatus', String(includeStatus));
    if (clientMessage) params.append('clientMessage', String(clientMessage));
    params.append('format', format as string);

    const url = `${PIERRE_API_BASE}/tools/api/get-transactions?${params.toString()}`;
    console.log('[Pierre] Fetching transactions from:', url.replace(apiKey, '***'));

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[Pierre] API error:', response.status, errorData);
      return res.status(response.status).json({
        success: false,
        error: 'Failed to fetch transactions',
        details: errorData
      });
    }

    const data = await response.json();
    console.log('[Pierre] Transactions response:', {
      success: data.success,
      dataCount: data.data?.length || 0,
      count: data.count
    });

    // Ensure consistent response structure
    res.json({
      success: data.success || true,
      data: data.data || [],
      count: data.count || data.data?.length || 0,
      filters: data.filters || {},
      timestamp: data.timestamp || new Date().toISOString()
    });
  } catch (error) {
    console.error('[Pierre] Error fetching transactions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch transactions',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const getPierreBalance: RequestHandler = async (req, res) => {
  try {
    const apiKey = process.env.VITE_PIERRE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ success: false, error: 'Pierre API key not configured' });
    }

    console.log('[Pierre] Fetching balance...');
    const response = await fetch(`${PIERRE_API_BASE}/tools/api/get-balance`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[Pierre] Balance API error:', response.status, errorData);
      return res.status(response.status).json({
        success: false,
        error: 'Failed to fetch balance',
        details: errorData
      });
    }

    const data = await response.json();
    console.log('[Pierre] Balance response:', {
      success: data.success,
      hasAccounts: !!data.data?.accounts,
      accountCount: data.data?.accounts?.length || 0,
      totalBalance: data.data?.total_balance
    });

    res.json(data);
  } catch (error) {
    console.error('[Pierre] Error fetching balance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch balance',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const getPierreBills: RequestHandler = async (req, res) => {
  try {
    const apiKey = process.env.VITE_PIERRE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Pierre API key not configured' });
    }

    const { accountId } = req.query;
    const params = new URLSearchParams();
    if (accountId) params.append('accountId', String(accountId));

    const url = `${PIERRE_API_BASE}/tools/api/get-bills${params.toString() ? '?' + params.toString() : ''}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        error: 'Failed to fetch bills',
        details: errorData
      });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error fetching Pierre bills:', error);
    res.status(500).json({
      error: 'Failed to fetch bills',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const getPierreBillSummary: RequestHandler = async (req, res) => {
  try {
    const apiKey = process.env.VITE_PIERRE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Pierre API key not configured' });
    }

    const { accountId, closingDay, startDate, endDate } = req.query;
    const params = new URLSearchParams();
    if (accountId) params.append('accountId', String(accountId));
    if (closingDay) params.append('closingDay', String(closingDay));
    if (startDate) params.append('startDate', String(startDate));
    if (endDate) params.append('endDate', String(endDate));

    const url = `${PIERRE_API_BASE}/tools/api/get-bill-summary${params.toString() ? '?' + params.toString() : ''}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        error: 'Failed to fetch bill summary',
        details: errorData
      });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error fetching Pierre bill summary:', error);
    res.status(500).json({
      error: 'Failed to fetch bill summary',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const getPierreInstallments: RequestHandler = async (req, res) => {
  try {
    const apiKey = process.env.VITE_PIERRE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Pierre API key not configured' });
    }

    const response = await fetch(`${PIERRE_API_BASE}/tools/api/get-installments`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        error: 'Failed to fetch installments',
        details: errorData
      });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error fetching Pierre installments:', error);
    res.status(500).json({
      error: 'Failed to fetch installments',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const debugAllMonths: RequestHandler = async (req, res) => {
  try {
    const apiKey = process.env.VITE_PIERRE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Pierre API key not configured' });
    }

    // Get last 6 months of data
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);

    const startDateStr = sixMonthsAgo.toISOString().split('T')[0];
    const endDateStr = now.toISOString().split('T')[0];

    const params = new URLSearchParams();
    params.append('startDate', startDateStr);
    params.append('endDate', endDateStr);
    params.append('format', 'raw');

    const url = `https://www.pierre.finance/tools/api/get-transactions?${params.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        error: 'Failed to fetch transactions',
        details: errorData
      });
    }

    const data = await response.json();
    const transactions = data.data || [];

    // Group by month and calculate totals
    const byMonth: Record<string, any> = {};
    transactions.forEach((t: any) => {
      const tDate = new Date(t.date);
      const monthStr = `${tDate.getFullYear()}-${String(tDate.getMonth() + 1).padStart(2, '0')}`;
      if (!byMonth[monthStr]) {
        byMonth[monthStr] = { count: 0, credits: 0, debits: 0 };
      }
      byMonth[monthStr].count++;
      if (t.type === 'CREDIT') {
        byMonth[monthStr].credits += t.amount;
      } else {
        byMonth[monthStr].debits += t.amount;
      }
    });

    const monthlyBreakdown = Object.entries(byMonth)
      .sort()
      .reverse()
      .map(([month, info]) => ({
        month,
        count: info.count,
        credits: Math.round(info.credits * 100) / 100,
        debits: Math.round(info.debits * 100) / 100,
        saldo: Math.round((info.credits + info.debits) * 100) / 100
      }));

    res.json({
      period: { from: startDateStr, to: endDateStr },
      monthlyBreakdown,
      totalTransactions: transactions.length
    });
  } catch (error) {
    console.error('Error debugging all months:', error);
    res.status(500).json({
      error: 'Failed to debug all months',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const debugFilteredTransactions: RequestHandler = async (req, res) => {
  try {
    const apiKey = process.env.VITE_PIERRE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Pierre API key not configured' });
    }

    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Format dates as YYYY-MM-DD
    const startDateStr = firstDay.toISOString().split('T')[0];
    const endDateStr = lastDay.toISOString().split('T')[0];

    const params = new URLSearchParams();
    params.append('startDate', startDateStr);
    params.append('endDate', endDateStr);
    params.append('format', 'raw');
    params.append('includeStatus', 'POSTED'); // Only POSTED transactions

    const url = `https://www.pierre.finance/tools/api/get-transactions?${params.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        error: 'Failed to fetch transactions',
        details: errorData
      });
    }

    const data = await response.json();

    const transactions = data.data || [];
    const now2 = new Date();
    const currentMonth = now2.getMonth();
    const currentYear = now2.getFullYear();

    // Filter to only current month
    const mayTransactions = transactions.filter((t: any) => {
      const tDate = new Date(t.date);
      return tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear;
    });

    const credits = mayTransactions.filter((t: any) => t.type === 'CREDIT');
    const debits = mayTransactions.filter((t: any) => t.type === 'DEBIT');

    const totalCredits = credits.reduce((sum: number, t: any) => sum + t.amount, 0);
    const totalDebits = debits.reduce((sum: number, t: any) => sum + t.amount, 0);

    res.json({
      filtered: {
        totalTransactions: mayTransactions.length,
        creditsCount: credits.length,
        debitsCount: debits.length,
        totalCredits: Math.round(totalCredits * 100) / 100,
        totalDebits: Math.round(totalDebits * 100) / 100,
        saldo: Math.round((totalCredits + totalDebits) * 100) / 100
      },
      note: 'With includeStatus=POSTED filter only',
      totalFromAPI: {
        count: transactions.length
      }
    });
  } catch (error) {
    console.error('Error debugging filtered transactions:', error);
    res.status(500).json({
      error: 'Failed to debug filtered transactions',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const debugPierreTransactions: RequestHandler = async (req, res) => {
  try {
    const apiKey = process.env.VITE_PIERRE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Pierre API key not configured' });
    }

    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Format dates as YYYY-MM-DD
    const startDateStr = firstDay.toISOString().split('T')[0];
    const endDateStr = lastDay.toISOString().split('T')[0];

    const params = new URLSearchParams();
    params.append('startDate', startDateStr);
    params.append('endDate', endDateStr);
    params.append('format', 'raw');

    const url = `https://www.pierre.finance/tools/api/get-transactions?${params.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        error: 'Failed to fetch transactions',
        details: errorData
      });
    }

    const data = await response.json();

    // Debug: show what we got
    const transactions = data.data || [];
    const credits = transactions.filter((t: any) => t.type === 'CREDIT');
    const debits = transactions.filter((t: any) => t.type === 'DEBIT');

    const totalCredits = credits.reduce((sum: number, t: any) => sum + t.amount, 0);
    const totalDebits = debits.reduce((sum: number, t: any) => sum + t.amount, 0);

    // Group by month to see if there are transactions from other months
    const byMonth: Record<string, any> = {};
    transactions.forEach((t: any) => {
      const dateObj = new Date(t.date);
      const monthStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
      if (!byMonth[monthStr]) {
        byMonth[monthStr] = { count: 0, credits: 0, debits: 0, transactions: [] };
      }
      byMonth[monthStr].count++;
      if (t.type === 'CREDIT') {
        byMonth[monthStr].credits += t.amount;
      } else {
        byMonth[monthStr].debits += t.amount;
      }
      byMonth[monthStr].transactions.push({
        date: t.date,
        amount: t.amount,
        type: t.type,
        description: t.description.substring(0, 30)
      });
    });

    const sampleTransactions = transactions.slice(0, 10).map((t: any) => ({
      date: t.date,
      amount: t.amount,
      type: t.type,
      description: t.description
    }));

    // Show only May data for comparison
    const mayData = byMonth['2026-05'];
    const otherMonths = Object.entries(byMonth).filter(([month]) => month !== '2026-05');

    res.json({
      period: {
        startDate: startDateStr,
        endDate: endDateStr,
        month: now.getMonth() + 1,
        year: now.getFullYear()
      },
      requestedPeriod: {
        totalTransactions: transactions.length,
        creditsCount: credits.length,
        debitsCount: debits.length,
        totalCredits: Math.round(totalCredits * 100) / 100,
        totalDebits: Math.round(totalDebits * 100) / 100,
        saldo: Math.round((totalCredits - totalDebits) * 100) / 100
      },
      mayOnly: mayData ? {
        count: mayData.count,
        credits: Math.round(mayData.credits * 100) / 100,
        debits: Math.round(mayData.debits * 100) / 100,
        saldo: Math.round((mayData.credits + mayData.debits) * 100) / 100
      } : null,
      otherMonthsCount: otherMonths.length,
      otherMonths: otherMonths.map(([month, info]) => ({
        month,
        count: info.count,
        credits: Math.round(info.credits * 100) / 100,
        debits: Math.round(info.debits * 100) / 100
      })),
      warning: otherMonths.length > 0 ? 'API returned transactions from months other than requested!' : 'All transactions are from requested month'
    });
  } catch (error) {
    console.error('Error debugging Pierre transactions:', error);
    res.status(500).json({
      error: 'Failed to debug transactions',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const syncPierreData: RequestHandler = async (req, res) => {
  try {
    const apiKey = process.env.VITE_PIERRE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Pierre API key not configured' });
    }

    const errors: string[] = [];
    let accountsCount = 0;
    let transactionsCount = 0;
    let installmentsCount = 0;

    // Fetch accounts
    try {
      const accountsRes = await fetch(`${PIERRE_API_BASE}/tools/api/get-accounts`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (accountsRes.ok) {
        const accountsData = await accountsRes.json();
        accountsCount = accountsData.count || accountsData.data?.length || 0;
      } else {
        errors.push('Failed to fetch accounts');
      }
    } catch (error) {
      errors.push(`Accounts error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Fetch transactions (last 90 days)
    try {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 90 * 24 * 60 * 60 * 1000);

      const params = new URLSearchParams();
      params.append('startDate', startDate.toISOString().split('T')[0]);
      params.append('endDate', endDate.toISOString().split('T')[0]);
      params.append('format', 'raw');

      const transRes = await fetch(`${PIERRE_API_BASE}/tools/api/get-transactions?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (transRes.ok) {
        const transData = await transRes.json();
        transactionsCount = transData.count || transData.data?.length || 0;
      } else {
        errors.push('Failed to fetch transactions');
      }
    } catch (error) {
      errors.push(`Transactions error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Fetch installments
    try {
      const installRes = await fetch(`${PIERRE_API_BASE}/tools/api/get-installments`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (installRes.ok) {
        const installData = await installRes.json();
        installmentsCount = installData.count || installData.data?.length || 0;
      } else {
        errors.push('Failed to fetch installments');
      }
    } catch (error) {
      errors.push(`Installments error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      accountsCount,
      transactionsImported: transactionsCount,
      installmentsFound: installmentsCount,
      errors
    });
  } catch (error) {
    console.error('Error syncing Pierre data:', error);
    res.status(500).json({
      error: 'Failed to sync data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
