-- Schema para Capital - Supabase (PostgreSQL)
-- Execute no SQL Editor do Supabase: https://app.supabase.com/project/vichwjcerggsmnrxcdnu/sql/new

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabela de usuários (autenticação simples)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de categorias
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    icon TEXT,
    color TEXT,
    type TEXT NOT NULL CHECK (type IN ('receita', 'despesa')),
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Tabela de transações
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('receita', 'despesa')),
    category_id UUID NOT NULL,
    description TEXT NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    date DATE NOT NULL,
    source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'open-finance', 'importacao')),
    source_details JSONB,
    tags JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories (id)
);

-- Tabela de investimentos
CREATE TABLE IF NOT EXISTS investments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    purchase_date DATE NOT NULL,
    purchase_price DECIMAL(12, 2) NOT NULL,
    quantity DECIMAL(12, 4) NOT NULL,
    current_price DECIMAL(12, 2),
    broker TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Tabela de objetivos/metas
CREATE TABLE IF NOT EXISTS goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    title TEXT NOT NULL,
    target_amount DECIMAL(12, 2) NOT NULL,
    current_amount DECIMAL(12, 2) DEFAULT 0,
    target_date DATE,
    description TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Tabela de alocações para objetivos
CREATE TABLE IF NOT EXISTS goal_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    goal_id UUID NOT NULL,
    transaction_id UUID NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (goal_id) REFERENCES goals (id) ON DELETE CASCADE,
    FOREIGN KEY (transaction_id) REFERENCES transactions (id) ON DELETE CASCADE
);

-- Tabela de divisão financeira/orçamento
CREATE TABLE IF NOT EXISTS budget_divisions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    percentage DECIMAL(5, 2) NOT NULL,
    color TEXT,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Tabela de categorias de orçamento
CREATE TABLE IF NOT EXISTS budget_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    division_id UUID NOT NULL,
    name TEXT NOT NULL,
    allocated_amount DECIMAL(12, 2) NOT NULL,
    spent_amount DECIMAL(12, 2) DEFAULT 0,
    icon TEXT,
    color TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (division_id) REFERENCES budget_divisions (id) ON DELETE CASCADE
);

-- Tabela de alocações de orçamento
CREATE TABLE IF NOT EXISTS budget_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    transaction_id UUID NOT NULL,
    budget_category_id UUID NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (transaction_id) REFERENCES transactions (id) ON DELETE CASCADE,
    FOREIGN KEY (budget_category_id) REFERENCES budget_categories (id) ON DELETE CASCADE
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions (user_id, date);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions (category_id);
CREATE INDEX IF NOT EXISTS idx_investments_user ON investments (user_id);
CREATE INDEX IF NOT EXISTS idx_goals_user ON goals (user_id);
CREATE INDEX IF NOT EXISTS idx_goal_allocations_goal ON goal_allocations (goal_id);
CREATE INDEX IF NOT EXISTS idx_budget_categories_division ON budget_categories (division_id);
CREATE INDEX IF NOT EXISTS idx_budget_allocations_category ON budget_allocations (budget_category_id);
CREATE INDEX IF NOT EXISTS idx_categories_user ON categories (user_id);

-- Configurar Row Level Security (RLS) para segurança
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_divisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_allocations ENABLE ROW LEVEL SECURITY;

-- Políticas RLS: cada usuário só vê seus próprios dados
CREATE POLICY "Users can read own data" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Categories visible to owner" ON categories FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Categories insert by owner" ON categories FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Transactions visible to owner" ON transactions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Transactions insert by owner" ON transactions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Investments visible to owner" ON investments FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Investments insert by owner" ON investments FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Goals visible to owner" ON goals FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Goals insert by owner" ON goals FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Goal allocations visible to owner" ON goal_allocations FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Goal allocations insert by owner" ON goal_allocations FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Budget divisions visible to owner" ON budget_divisions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Budget divisions insert by owner" ON budget_divisions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Budget categories visible to owner" ON budget_categories FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Budget categories insert by owner" ON budget_categories FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Budget allocations visible to owner" ON budget_allocations FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Budget allocations insert by owner" ON budget_allocations FOR INSERT WITH CHECK (user_id = auth.uid());

-- UPDATE policies
CREATE POLICY "Categories update by owner" ON categories FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Transactions update by owner" ON transactions FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Investments update by owner" ON investments FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Goals update by owner" ON goals FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Budget divisions update by owner" ON budget_divisions FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Budget categories update by owner" ON budget_categories FOR UPDATE USING (user_id = auth.uid());

-- DELETE policies
CREATE POLICY "Categories delete by owner" ON categories FOR DELETE USING (user_id = auth.uid());
CREATE POLICY "Transactions delete by owner" ON transactions FOR DELETE USING (user_id = auth.uid());
CREATE POLICY "Investments delete by owner" ON investments FOR DELETE USING (user_id = auth.uid());
CREATE POLICY "Goals delete by owner" ON goals FOR DELETE USING (user_id = auth.uid());
CREATE POLICY "Goal allocations delete by owner" ON goal_allocations FOR DELETE USING (user_id = auth.uid());
CREATE POLICY "Budget divisions delete by owner" ON budget_divisions FOR DELETE USING (user_id = auth.uid());
CREATE POLICY "Budget categories delete by owner" ON budget_categories FOR DELETE USING (user_id = auth.uid());
CREATE POLICY "Budget allocations delete by owner" ON budget_allocations FOR DELETE USING (user_id = auth.uid());
