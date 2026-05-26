import { RequestHandler } from 'express';

const PIERRE_API_BASE = 'https://www.pierre.finance/tools/api';

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
    const url = `${PIERRE_API_BASE}/get-${endpoint}${queryString}`;

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

    const response = await fetch(`${PIERRE_API_BASE}/get-accounts`, {
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

    const url = `${PIERRE_API_BASE}/get-transactions?${params.toString()}`;

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
