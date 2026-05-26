import { RequestHandler } from "express";

interface QuoteResponse {
  symbol: string;
  price: number;
  change24h: number;
  lastUpdate: string;
}

const DEFAULT_PRICES: Record<string, number> = {
  bitcoin: 420000,
  ethereum: 22000,
  dolar: 5.20,
  euro: 5.65,
  ouro: 350,
  prata: 4.5,
  tesouro_direto: 1.0,
  cdb: 1.0,
  lci_lca: 1.0
};

async function fetchCoinMarketCapQuote(coinId: string): Promise<QuoteResponse> {
  const apiKey = process.env.VITE_COINMARKETCAP_API_KEY || '94d4a907464a4b79ba039952eff85bb5';

  const symbolMap: Record<string, string> = {
    bitcoin: 'BTC',
    ethereum: 'ETH'
  };

  const symbol = symbolMap[coinId] || 'BTC';

  try {
    const response = await fetch(
      `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=${symbol}&convert=BRL`,
      {
        method: 'GET',
        headers: {
          'Accepts': 'application/json',
          'X-CMC_PRO_API_KEY': apiKey,
        }
      }
    );

    if (!response.ok) {
      throw new Error(`CoinMarketCap error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.data || !data.data[symbol]) {
      throw new Error(`Invalid quote data for ${symbol}`);
    }

    const coinData = data.data[symbol];
    const priceData = coinData.quote.BRL;

    return {
      symbol: symbol,
      price: priceData.price,
      change24h: priceData.percent_change_24h || 0,
      lastUpdate: new Date().toISOString()
    };
  } catch (error) {
    console.warn(`CoinMarketCap API failed: ${error}, falling back to CoinGecko`);
    throw error;
  }
}

async function fetchCoinGeckoQuote(coinId: string): Promise<QuoteResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=brl&include_24hr_change=true`,
      { signal: controller.signal }
    );

    if (!response.ok) {
      throw new Error(`CoinGecko error: ${response.status}`);
    }

    const data = await response.json();
    const coinData = data[coinId];

    if (!coinData || !coinData.brl) {
      throw new Error(`Invalid quote data for ${coinId}`);
    }

    return {
      symbol: coinId.toUpperCase(),
      price: coinData.brl,
      change24h: coinData.brl_24h_change || 0,
      lastUpdate: new Date().toISOString()
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchCurrencyQuote(currency: string): Promise<QuoteResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(
      `https://economia.awesomeapi.com.br/last/${currency}-BRL`,
      { signal: controller.signal }
    );

    if (!response.ok) {
      throw new Error('Currency API error');
    }

    const data = await response.json();
    const currencyData = data[`${currency}BRL`];

    return {
      symbol: currency,
      price: parseFloat(currencyData.bid),
      change24h: parseFloat(currencyData.pctChange),
      lastUpdate: currencyData.create_date
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

function getDefaultQuote(type: string): QuoteResponse {
  return {
    symbol: type.toUpperCase(),
    price: DEFAULT_PRICES[type] || 1,
    change24h: 0,
    lastUpdate: new Date().toISOString()
  };
}

export const handleQuote: RequestHandler = async (req, res) => {
  const { type } = req.params;

  try {
    let quote: QuoteResponse;

    switch (type) {
      case 'bitcoin':
        quote = await fetchCoinGeckoQuote('bitcoin');
        break;
      case 'ethereum':
        quote = await fetchCoinGeckoQuote('ethereum');
        break;
      case 'dolar':
        quote = await fetchCurrencyQuote('USD');
        break;
      case 'euro':
        quote = await fetchCurrencyQuote('EUR');
        break;
      case 'ouro':
      case 'prata':
        // For commodities, return cached default for now
        quote = getDefaultQuote(type);
        break;
      case 'tesouro_direto':
      case 'cdb':
      case 'lci_lca':
        // For fixed income, return cached default
        quote = getDefaultQuote(type);
        break;
      default:
        return res.status(400).json({ error: `Unsupported investment type: ${type}` });
    }

    res.json(quote);
  } catch (error) {
    console.error(`Error fetching quote for ${type}:`, error);
    // Return default quote on error instead of failing
    res.json(getDefaultQuote(type));
  }
};
