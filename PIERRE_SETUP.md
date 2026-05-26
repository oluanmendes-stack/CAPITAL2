# Pierre Finance - Integração Completa

## 📋 Visão Geral

O **Pierre Finance** é um agregador de dados financeiros que conecta múltiplos bancos brasileiros (Nubank, Recarga Pay, Inter, Itaú, etc.) em uma única plataforma. Esta integração permite que os usuários gerenciem todas as suas contas bancárias de forma centralizada no Capital.

## ✨ Funcionalidades Implementadas

### 1. **Contas Financeiras**
- Acesse todas as contas conectadas (correntes, poupança, cartões de crédito, investimentos)
- Visualize informações detalhadas de cada conta
- Identificar tipo de conta (banco, provedor) facilmente

### 2. **Saldos Consolidados**
- **Saldo Total**: Visualize seu patrimônio agregado
- **Saldos por Tipo**: Correntes, poupança, cartões e investimentos separados
- **Saldos por Provedor**: Veja quanto você tem em cada banco
- **Saldo Disponível**: Informações de saldo utilizável por conta

### 3. **Transações Completas**
- Histórico completo de transações com filtros avançados
- Últimas 90 dias (período configurável via API)
- Detalhes de categoria, valor, data e status
- Distinção entre débitos e créditos

### 4. **Parcelas e Cronogramas**
- Monitore todas as compras parceladas
- Cronograma completo de pagamentos
- Status das parcelas (pendentes, pagas, vencidas)
- Datas de próximo pagamento e conclusão

### 5. **Sincronização Manual**
- Force atualizações manuais de dados a qualquer momento
- Relatório detalhado após sincronização:
  - Número de contas sincronizadas
  - Transações importadas
  - Parcelas encontradas
  - Erros (se houver)

## 🔧 Configuração

### Variáveis de Ambiente

Configure a seguinte variável de ambiente:

```env
VITE_PIERRE_API_KEY=seu_pierre_api_key_aqui
```

A chave da API Pierre deve ser obtida no painel de desenvolvedor do Pierre Finance (https://pierre.finance).

### Endpoints da API

O servidor expõe os seguintes endpoints para o Pierre:

#### GET `/api/pierre/accounts`
Obtém todas as contas conectadas ao Pierre.

**Resposta:**
```json
{
  "success": true,
  "data": [
    {
      "accountId": "123",
      "accountName": "Minha Conta Corrente",
      "accountType": "checking",
      "accountBalance": 5000.00,
      "accountCurrencyCode": "BRL",
      "providerCode": "nubank"
    }
  ],
  "count": 1,
  "timestamp": "2024-05-26T10:00:00Z"
}
```

#### GET `/api/pierre/transactions`
Obtém transações filtradas por período.

**Query Parameters:**
- `startDate`: Data inicial (YYYY-MM-DD)
- `endDate`: Data final (YYYY-MM-DD)
- `categories`: Categorias separadas por vírgula
- `format`: Formato (raw, grouped, etc.)

#### GET `/api/pierre/installments`
Obtém cronogramas de parcelas.

**Resposta:**
```json
{
  "success": true,
  "data": [
    {
      "transactionId": "tx_123",
      "description": "Compra na Lojas ABC",
      "totalAmount": 1200.00,
      "installmentCount": 12,
      "currency": "BRL",
      "installments": [
        {
          "id": "inst_1",
          "description": "Parcela 1/12",
          "amount": 100.00,
          "installmentNumber": 1,
          "totalInstallments": 12,
          "dueDate": "2024-06-10",
          "status": "pending"
        }
      ]
    }
  ]
}
```

#### GET `/api/pierre/sync`
Força sincronização manual e retorna estatísticas.

**Resposta:**
```json
{
  "success": true,
  "timestamp": "2024-05-26T10:00:00Z",
  "accountsCount": 5,
  "transactionsImported": 342,
  "installmentsFound": 8,
  "errors": []
}
```

## 🎯 Como Usar

### Na Interface

1. Vá para **Configurações** (aba Settings no dashboard)
2. Encontre a seção **"Open Finance"**
3. Clique em **"Gerenciar Conexões"**
4. Selecione a aba **"Pierre Finance"**
5. Escolha entre três visualizações:

#### **Contas e Saldos**
- Visualize saldo consolidado
- Veja detalhamento por tipo de conta
- Saldos por provedor (banco)
- Contas individuais com saldos atualizados

#### **Parcelas**
- Lista completa de compras parceladas
- Cronograma de pagamentos
- Status de cada parcela
- Próxima data de pagamento

#### **Sincronização**
- Botão para sincronizar dados manualmente
- Relatório de sincronização
- Histórico de última sincronização

### No Código

```typescript
import { pierreFinanceService } from '@shared/pierreFinanceService';

// Obter contas
const accounts = await pierreFinanceService.getAccounts();

// Obter saldos individuais
const balances = await pierreFinanceService.getBalances();

// Obter saldo consolidado
const consolidated = await pierreFinanceService.getConsolidatedBalance();

// Obter transações (últimos 90 dias)
const transactions = await pierreFinanceService.getTransactions(
  '2024-02-26',
  '2024-05-26',
  ['alimentacao', 'transporte']
);

// Obter parcelas
const installments = await pierreFinanceService.getInstallments();

// Sincronizar dados
const syncResult = await pierreFinanceService.syncData();
```

## 📊 Tipos de Dados

### PierreBalance
```typescript
interface PierreBalance {
  accountId: string;
  accountName: string;
  accountType: 'checking' | 'savings' | 'credit_card' | 'investment';
  balance: number;
  availableBalance?: number;
  currencyCode: string;
  lastUpdate: string;
}
```

### PierreConsolidatedBalance
```typescript
interface PierreConsolidatedBalance {
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
```

### PierreInstallmentSchedule
```typescript
interface PierreInstallmentSchedule {
  transactionId: string;
  description: string;
  totalAmount: number;
  installmentCount: number;
  currency: string;
  installments: PierreInstallment[];
  nextPaymentDate?: string;
  completionDate?: string;
}
```

## 🔒 Segurança

- A chave API do Pierre é mantida no servidor (variável de ambiente)
- O cliente acessa os dados através do servidor proxy em `/api/pierre/*`
- Todos os dados são criptografados em trânsito (HTTPS)
- A chave API nunca é exposta ao cliente

## 🚀 Implantação

O Pierre Finance está totalmente integrado e pronto para produção:

1. Configure `VITE_PIERRE_API_KEY` no seu ambiente
2. Deploy normalmente usando Netlify ou seu provider
3. Os endpoints estarão disponíveis em `https://seu-dominio.com/api/pierre/*`

## 📝 Limitações e Notas

- Sincronização obtém transações dos últimos 90 dias por padrão
- Parcelas são agregadas do histórico de transações
- Atualizações de saldo são em tempo real quando disponível pela API Pierre
- Alguns bancos podem ter latência na atualização de dados

## 🔗 Referências

- **Pierre Finance Docs**: https://pierre.finance/docs
- **Bancos Suportados**: Nubank, Recarga Pay, Inter, Itaú, Bradesco, etc.
- **OPEN_FINANCE_SETUP.md**: Configuração geral de Open Finance

## 📞 Suporte

Para problemas com integração:
1. Verifique se `VITE_PIERRE_API_KEY` está configurada
2. Consulte os logs do servidor em `/api/pierre/*`
3. Abra uma issue com detalhes da erro
