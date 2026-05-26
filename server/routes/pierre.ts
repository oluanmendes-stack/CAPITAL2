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

    const { startDate, endDate, categories, format = 'raw' } = req.query;

    const params = new URLSearchParams();
    if (startDate) params.append('startDate', String(startDate));
    if (endDate) params.append('endDate', String(endDate));
    if (categories) params.append('categories', String(categories));
    params.append('format', format as string);

    const url = `${PIERRE_API_BASE}/tools/api/get-transactions?${params.toString()}`;

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
    res.json(data);
  } catch (error) {
    console.error('Error fetching Pierre transactions:', error);
    res.status(500).json({
      error: 'Failed to fetch transactions',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const getPierreBalance: RequestHandler = async (req, res) => {
  try {
    const apiKey = process.env.VITE_PIERRE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Pierre API key not configured' });
    }

    const response = await fetch(`${PIERRE_API_BASE}/tools/api/get-balance`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        error: 'Failed to fetch balance',
        details: errorData
      });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error fetching Pierre balance:', error);
    res.status(500).json({
      error: 'Failed to fetch balance',
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
