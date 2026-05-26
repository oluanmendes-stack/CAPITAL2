import { InvestmentType, QuoteResponse } from '@shared/investment-types';

class QuoteService {
  private cache = new Map<string, { data: QuoteResponse; timestamp: number }>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutos
  private readonly FETCH_TIMEOUT = 5000; // 5 segundos de timeout

  private fetchWithTimeout(url: string, options?: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.FETCH_TIMEOUT);

    return fetch(url, { ...options, signal: controller.signal })
      .finally(() => clearTimeout(timeoutId));
  }

  // Buscar cotação atual
  async getCurrentQuote(type: InvestmentType): Promise<QuoteResponse> {
    const cacheKey = `quote_${type}`;
    const cached = this.cache.get(cacheKey);

    // Verificar cache
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }

    try {
      let quote: QuoteResponse;

      switch (type) {
        case 'bitcoin':
          quote = await this.fetchCryptoQuote('bitcoin');
          break;
        case 'ethereum':
          quote = await this.fetchCryptoQuote('ethereum');
          break;
        case 'dolar':
          quote = await this.fetchCurrencyQuote('USD');
          break;
        case 'euro':
          quote = await this.fetchCurrencyQuote('EUR');
          break;
        case 'ouro':
          quote = await this.fetchCommodityQuote('gold');
          break;
        case 'prata':
          quote = await this.fetchCommodityQuote('silver');
          break;
        case 'tesouro_direto':
        case 'cdb':
        case 'lci_lca':
          // Para títulos de renda fixa, usar valores simulados ou APIs específicas
          quote = await this.fetchFixedIncomeQuote(type);
          break;
        default:
          throw new Error(`Tipo de investimento não suportado: ${type}`);
      }

      // Salvar no cache
      this.cache.set(cacheKey, {
        data: quote,
        timestamp: Date.now()
      });

      return quote;
    } catch (error) {
      console.error(`Erro ao buscar cotação para ${type}:`, error);

      // Retornar cotação padrão em caso de erro
      return this.getDefaultQuote(type);
    }
  }

  // Buscar múltiplas cotações
  async getMultipleQuotes(types: InvestmentType[]): Promise<Record<InvestmentType, QuoteResponse>> {
    const promises = types.map(async (type) => {
      const quote = await this.getCurrentQuote(type);
      return [type, quote] as [InvestmentType, QuoteResponse];
    });

    const results = await Promise.all(promises);
    return Object.fromEntries(results) as Record<InvestmentType, QuoteResponse>;
  }

  // Buscar cotação via API backend
  private async fetchQuoteFromBackend(type: InvestmentType): Promise<QuoteResponse> {
    try {
      const response = await this.fetchWithTimeout(`/api/quote/${type}`);

      if (!response.ok) {
        throw new Error(`Erro ao buscar cotação: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.warn(`Erro ao buscar cotação de ${type}:`, error);
      throw error;
    }
  }

  // Buscar cotação de criptomoeda (agora via backend)
  private async fetchCryptoQuote(coinId: string): Promise<QuoteResponse> {
    return this.fetchQuoteFromBackend(coinId as InvestmentType);
  }

  // Buscar cotação de moeda (agora via backend)
  private async fetchCurrencyQuote(currency: string): Promise<QuoteResponse> {
    const currencyMap: Record<string, InvestmentType> = {
      'USD': 'dolar',
      'EUR': 'euro'
    };
    return this.fetchQuoteFromBackend(currencyMap[currency] || 'dolar');
  }

  // Buscar cotação de commodities (agora via backend)
  private async fetchCommodityQuote(commodity: string): Promise<QuoteResponse> {
    const commodityMap: Record<string, InvestmentType> = {
      'gold': 'ouro',
      'silver': 'prata'
    };
    return this.fetchQuoteFromBackend(commodityMap[commodity] || 'ouro');
  }

  // Buscar cotação de renda fixa (agora via backend)
  private async fetchFixedIncomeQuote(type: InvestmentType): Promise<QuoteResponse> {
    return this.fetchQuoteFromBackend(type);
  }

  // Cotação padrão em caso de erro
  private getDefaultQuote(type: InvestmentType): QuoteResponse {
    const defaultPrices = {
      bitcoin: 420000, // Preço aproximado atual do Bitcoin em BRL
      ethereum: 22000,  // Preço aproximado atual do Ethereum em BRL
      dolar: 5.20,
      euro: 5.65,
      ouro: 350,
      prata: 4.5,
      tesouro_direto: 1.0,
      cdb: 1.0,
      lci_lca: 1.0
    };

    return {
      symbol: type.toUpperCase(),
      price: defaultPrices[type] || 1,
      change24h: 0,
      lastUpdate: new Date().toISOString()
    };
  }

  // Limpar cache
  clearCache(): void {
    this.cache.clear();
  }
}

export const quoteService = new QuoteService();
