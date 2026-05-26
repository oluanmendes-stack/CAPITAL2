import { createClient } from '@supabase/supabase-js';
import { 
  User, 
  UserCreate, 
  UserLogin, 
  DBCategory,
  DBTransaction,
  CreateTransactionRequest,
  UpdateTransactionRequest,
  CreateBudgetDivisionRequest,
  UpdateBudgetDivisionRequest,
  CreateBudgetCategoryRequest,
  UpdateBudgetCategoryRequest,
  DBBudgetDivision,
  DBBudgetCategory,
  DBBudgetAllocation,
  TransactionFilters
} from '@shared/database-types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log('🔧 Supabase init - URL:', supabaseUrl ? '✓' : '✗', 'Key:', supabaseAnonKey ? '✓' : '✗');

let supabase: any = null;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('❌ Missing Supabase environment variables - database operations will be limited');
  console.warn('   VITE_SUPABASE_URL:', supabaseUrl);
  console.warn('   VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? '***' : 'undefined');
} else {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
    console.log('✅ Supabase client initialized successfully');
  } catch (error) {
    console.warn('❌ Failed to initialize Supabase client:', error);
  }
}

class SupabaseService {
  private currentUser: User | null = null;

  async register(userData: UserCreate): Promise<{ user: User; token: string }> {
    if (!supabase) {
      throw new Error('Database service not available');
    }
    try {
      // Usar autenticação do Supabase
      const { data, error } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
        options: {
          data: {
            name: userData.name || ''
          }
        }
      });

      if (error) throw error;
      if (!data.user) throw new Error('User creation failed');

      const user: User = {
        id: data.user.id,
        email: data.user.email || '',
        name: userData.name,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const token = data.session?.access_token || '';
      this.currentUser = user;

      return { user, token };
    } catch (error) {
      console.error('Erro ao registrar:', error);
      throw error;
    }
  }

  async login(credentials: UserLogin): Promise<{ user: User; token: string }> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password
      });

      if (error) throw error;
      if (!data.user) throw new Error('Login failed');

      const user: User = {
        id: data.user.id,
        email: data.user.email || '',
        name: data.user.user_metadata?.name || null,
        created_at: data.user.created_at,
        updated_at: data.user.updated_at
      };

      const token = data.session?.access_token || '';
      this.currentUser = user;

      return { user, token };
    } catch (error) {
      console.error('Erro ao fazer login:', error);
      throw error;
    }
  }

  async logout(): Promise<void> {
    try {
      await supabase.auth.signOut();
      this.currentUser = null;
    } catch (error) {
      console.warn('Erro ao fazer logout:', error);
    }
  }

  async getCurrentUser(): Promise<User | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        this.currentUser = {
          id: user.id,
          email: user.email || '',
          name: user.user_metadata?.name || null,
          created_at: user.created_at,
          updated_at: user.updated_at
        };
        return this.currentUser;
      }
      return null;
    } catch (error) {
      console.warn('Erro ao obter usuário atual:', error);
      return null;
    }
  }

  // ========== CATEGORIAS ==========
  async getCategories(): Promise<DBCategory[]> {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) return [];

      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.id)
        .order('type, name');

      if (error) throw error;

      let categories = (data as DBCategory[]) || [];

      // Auto-seed default categories if empty
      if (categories.length === 0) {
        await this.createDefaultCategories();
        return this.getCategories();
      }

      return categories;
    } catch (error) {
      console.warn('Erro ao buscar categorias do Supabase:', error);
      return [];
    }
  }

  private async createDefaultCategories(): Promise<void> {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) return;

      const defaultCategories = [
        // Receitas
        { name: 'Salário', type: 'receita', icon: '💰', color: '#10B981', is_default: true, user_id: user.id },
        { name: 'Freelance', type: 'receita', icon: '💻', color: '#3B82F6', is_default: true, user_id: user.id },
        { name: 'Investimentos', type: 'receita', icon: '📈', color: '#8B5CF6', is_default: true, user_id: user.id },
        { name: 'Outros', type: 'receita', icon: '💵', color: '#F59E0B', is_default: true, user_id: user.id },
        // Despesas
        { name: 'Alimentação', type: 'despesa', icon: '🍔', color: '#EF4444', is_default: true, user_id: user.id },
        { name: 'Transporte', type: 'despesa', icon: '🚗', color: '#EC4899', is_default: true, user_id: user.id },
        { name: 'Moradia', type: 'despesa', icon: '🏠', color: '#F97316', is_default: true, user_id: user.id },
        { name: 'Saúde', type: 'despesa', icon: '🏥', color: '#06B6D4', is_default: true, user_id: user.id },
        { name: 'Educação', type: 'despesa', icon: '📚', color: '#0EA5E9', is_default: true, user_id: user.id },
        { name: 'Entretenimento', type: 'despesa', icon: '🎬', color: '#D946EF', is_default: true, user_id: user.id },
        { name: 'Compras', type: 'despesa', icon: '🛍️', color: '#A855F7', is_default: true, user_id: user.id },
        { name: 'Serviços', type: 'despesa', icon: '🔧', color: '#64748B', is_default: true, user_id: user.id },
        { name: 'Outros', type: 'despesa', icon: '❌', color: '#64748B', is_default: true, user_id: user.id }
      ];

      for (const category of defaultCategories) {
        try {
          const { error } = await supabase.from('categories').insert([category]);
          if (error) {
            console.warn('Error creating default category:', category.name, error);
          }
        } catch (e) {
          console.warn('Error creating category:', category.name, e);
        }
      }
    } catch (error) {
      console.error('Error creating default categories:', error);
    }
  }

  async createCategory(category: Omit<DBCategory, 'id' | 'user_id' | 'created_at'>): Promise<DBCategory> {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('categories')
        .insert([{
          ...category,
          user_id: user.id
        }])
        .select()
        .single();

      if (error) throw error;
      return data as DBCategory;
    } catch (error) {
      console.warn('Erro ao criar categoria:', error);
      throw error;
    }
  }

  async deleteCategory(categoryId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', categoryId)
        .eq('is_default', false);

      if (error) throw error;
      return true;
    } catch (error) {
      console.warn('Erro ao deletar categoria:', error);
      throw error;
    }
  }

  // ========== TRANSAÇÕES ==========
  async getTransactions(filters?: TransactionFilters): Promise<DBTransaction[]> {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) return [];

      let query = supabase.from('transactions').select('*').eq('user_id', user.id);

      if (filters?.category_id) {
        query = query.eq('category_id', filters.category_id);
      }
      if (filters?.type) {
        query = query.eq('type', filters.type);
      }
      if (filters?.start_date) {
        query = query.gte('date', filters.start_date);
      }
      if (filters?.end_date) {
        query = query.lte('date', filters.end_date);
      }

      const { data, error } = await query.order('date', { ascending: false });

      if (error) throw error;
      return (data as DBTransaction[]) || [];
    } catch (error) {
      console.warn('Erro ao buscar transações:', error);
      return [];
    }
  }

  async createTransaction(transaction: CreateTransactionRequest): Promise<DBTransaction> {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('transactions')
        .insert([{
          ...transaction,
          user_id: user.id
        }])
        .select()
        .single();

      if (error) throw error;
      return data as DBTransaction;
    } catch (error) {
      console.warn('Erro ao criar transação:', error);
      throw error;
    }
  }

  async updateTransaction(id: string, updates: UpdateTransactionRequest): Promise<DBTransaction> {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as DBTransaction;
    } catch (error) {
      console.warn('Erro ao atualizar transação:', error);
      throw error;
    }
  }

  async deleteTransaction(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.warn('Erro ao deletar transação:', error);
      throw error;
    }
  }

  // ========== DIVISÕES ORÇAMENTÁRIAS ==========
  async getBudgetDivisions(): Promise<DBBudgetDivision[]> {
    if (!supabase) {
      console.warn('Supabase not available, returning empty budget divisions');
      return [];
    }
    try {
      const { data, error } = await supabase
        .from('budget_divisions')
        .select('*')
        .order('sort_order');

      if (error) throw error;
      return (data as DBBudgetDivision[]) || [];
    } catch (error) {
      console.warn('Erro ao buscar divisões orçamentárias:', error);
      return [];
    }
  }

  async createBudgetDivision(division: CreateBudgetDivisionRequest): Promise<DBBudgetDivision> {
    if (!supabase) {
      throw new Error('Supabase not available');
    }
    try {
      const { data, error } = await supabase
        .from('budget_divisions')
        .insert([division])
        .select()
        .single();

      if (error) throw error;
      return data as DBBudgetDivision;
    } catch (error) {
      console.warn('Erro ao criar divisão orçamentária:', error);
      throw error;
    }
  }

  async updateBudgetDivision(id: string, updates: UpdateBudgetDivisionRequest): Promise<DBBudgetDivision> {
    try {
      const { data, error } = await supabase
        .from('budget_divisions')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as DBBudgetDivision;
    } catch (error) {
      console.warn('Erro ao atualizar divisão orçamentária:', error);
      throw error;
    }
  }

  async deleteBudgetDivision(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('budget_divisions')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.warn('Erro ao deletar divisão orçamentária:', error);
      throw error;
    }
  }

  // ========== CATEGORIAS DE ORÇAMENTO ==========
  async getBudgetCategories(): Promise<DBBudgetCategory[]> {
    if (!supabase) {
      console.warn('Supabase not available, returning empty budget categories');
      return [];
    }
    try {
      const { data, error } = await supabase
        .from('budget_categories')
        .select('*')
        .order('created_at');

      if (error) throw error;
      // Map the data and provide default values for allocated_amount and spent_amount
      return (data as any[])?.map(c => ({
        ...c,
        allocated_amount: 0,
        spent_amount: 0,
        user_id: c.user_id || '',
        division_id: c.division_id || ''
      })) || [];
    } catch (error) {
      console.warn('Erro ao buscar categorias orçamentárias:', error);
      return [];
    }
  }

  async createBudgetCategory(category: CreateBudgetCategoryRequest): Promise<DBBudgetCategory> {
    if (!supabase) {
      throw new Error('Supabase not available');
    }
    try {
      // Only send columns that exist in the table
      const insertData = {
        division_id: category.division_id,
        name: category.name,
        percentage: category.percentage || 0
      };

      const { data, error } = await supabase
        .from('budget_categories')
        .insert([insertData])
        .select('*')
        .single();

      if (error) throw error;
      // Provide default values for allocated_amount and spent_amount
      return {
        ...data,
        allocated_amount: 0,
        spent_amount: 0,
        user_id: data.user_id || '',
        division_id: data.division_id || ''
      } as DBBudgetCategory;
    } catch (error) {
      console.warn('Erro ao criar categoria orçamentária:', error);
      throw error;
    }
  }

  async updateBudgetCategory(id: string, updates: UpdateBudgetCategoryRequest): Promise<DBBudgetCategory> {
    if (!supabase) {
      throw new Error('Supabase not available');
    }
    try {
      // Only send columns that exist in the table
      const updateData: any = {};
      if (updates.name) updateData.name = updates.name;
      if (updates.division_id) updateData.division_id = updates.division_id;

      const { data, error } = await supabase
        .from('budget_categories')
        .update(updateData)
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw error;
      // Provide default values for allocated_amount and spent_amount
      return {
        ...data,
        allocated_amount: 0,
        spent_amount: 0,
        user_id: data.user_id || '',
        division_id: data.division_id || ''
      } as DBBudgetCategory;
    } catch (error) {
      console.warn('Erro ao atualizar categoria orçamentária:', error);
      throw error;
    }
  }

  async deleteBudgetCategory(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('budget_categories')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.warn('Erro ao deletar categoria orçamentária:', error);
      throw error;
    }
  }

  // ========== ALOCAÇÕES DE ORÇAMENTO ==========
  async getBudgetAllocations(): Promise<DBBudgetAllocation[]> {
    try {
      const { data, error } = await supabase
        .from('budget_allocations')
        .select('*');

      if (error) throw error;
      return (data as DBBudgetAllocation[]) || [];
    } catch (error) {
      console.warn('Erro ao buscar alocações orçamentárias:', error);
      return [];
    }
  }

  async createBudgetAllocation(allocation: any): Promise<DBBudgetAllocation> {
    try {
      const { data, error } = await supabase
        .from('budget_allocations')
        .insert([allocation])
        .select()
        .single();

      if (error) throw error;
      return data as DBBudgetAllocation;
    } catch (error) {
      console.warn('Erro ao criar alocação orçamentária:', error);
      throw error;
    }
  }

  async deleteBudgetAllocation(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('budget_allocations')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.warn('Erro ao deletar alocação orçamentária:', error);
      throw error;
    }
  }

  // ========== OBJETIVOS (GOALS) ==========
  async getGoals(): Promise<any[]> {
    if (!supabase) {
      console.warn('Supabase not available, returning empty goals');
      return [];
    }
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) return [];

      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', user.id)
        .order('target_date');

      if (error) throw error;
      return (data as any[]) || [];
    } catch (error) {
      console.warn('Erro ao buscar objetivos do Supabase:', error);
      return [];
    }
  }

  async createGoal(goal: any): Promise<any> {
    console.log('🎯 createGoal called with:', goal);

    if (!supabase) {
      console.error('❌ Supabase not available');
      throw new Error('Supabase not available');
    }
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      console.log('👤 Current user:', user?.id, 'Auth error:', authError);

      if (authError || !user) {
        console.error('❌ User not authenticated:', authError);
        throw new Error('User not authenticated');
      }

      const goalData = {
        title: goal.title,
        target_amount: goal.target_amount,
        current_amount: goal.current_amount,
        target_date: goal.target_date,
        description: goal.description,
        user_id: user.id
      };

      console.log('📝 Inserting goal data:', goalData);

      const { data, error } = await supabase
        .from('goals')
        .insert([goalData])
        .select()
        .single();

      if (error) {
        console.error('❌ Supabase insert error:', error);
        throw error;
      }

      console.log('✅ Goal created successfully:', data);
      return data;
    } catch (error) {
      console.error('❌ Erro ao criar objetivo:', error);
      throw error;
    }
  }

  async updateGoal(id: string, updates: any): Promise<any> {
    if (!supabase) {
      throw new Error('Supabase not available');
    }
    try {
      const updateData: any = {};
      if (updates.title) updateData.title = updates.title;
      if (updates.target_amount !== undefined) updateData.target_amount = updates.target_amount;
      if (updates.current_amount !== undefined) updateData.current_amount = updates.current_amount;
      if (updates.target_date) updateData.target_date = updates.target_date;
      if (updates.description) updateData.description = updates.description;

      const { data, error } = await supabase
        .from('goals')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.warn('Erro ao atualizar objetivo:', error);
      throw error;
    }
  }

  async deleteGoal(id: string): Promise<boolean> {
    if (!supabase) {
      throw new Error('Supabase not available');
    }
    try {
      const { error } = await supabase
        .from('goals')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.warn('Erro ao deletar objetivo:', error);
      throw error;
    }
  }

  // ========== INVESTIMENTOS ==========
  async getInvestments(): Promise<any[]> {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) return [];

      const { data, error } = await supabase
        .from('investments')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at');

      if (error) throw error;
      return (data as any[]) || [];
    } catch (error) {
      console.warn('Erro ao buscar investimentos do Supabase:', error);
      return [];
    }
  }

  async createInvestment(investment: any): Promise<any> {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('investments')
        .insert([{
          ...investment,
          user_id: user.id
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.warn('Erro ao criar investimento:', error);
      throw error;
    }
  }

  async updateInvestment(id: string, updates: any): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('investments')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.warn('Erro ao atualizar investimento:', error);
      throw error;
    }
  }

  async deleteInvestment(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('investments')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.warn('Erro ao deletar investimento:', error);
      throw error;
    }
  }
}

export const supabaseService = new SupabaseService();
export default supabaseService;
