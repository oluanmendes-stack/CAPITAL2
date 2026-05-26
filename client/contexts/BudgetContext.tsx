import React, { createContext, useContext, useReducer, useCallback, useEffect, useState } from 'react';
import {
  BudgetCategory,
  BudgetExpense,
  CategoryBudgetStatus,
  BudgetSummary,
  calculateCategoryStatus,
  calculateBudgetSummary,
  DEFAULT_BUDGET_CATEGORIES
} from '@shared/budget-types';
import { DBBudgetDivision, DBBudgetCategory, DBBudgetAllocation } from '@shared/database-types';
import supabaseService from '../services/supabaseService';
import { useAuth } from './AuthContext';

interface BudgetState {
  categories: BudgetCategory[];
  expenses: BudgetExpense[];
  summary: BudgetSummary;
}

interface BudgetContextType extends BudgetState {
  addCategory: (category: Omit<BudgetCategory, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateCategory: (category: BudgetCategory) => void;
  deleteCategory: (id: string) => void;
  addExpense: (expense: Omit<BudgetExpense, 'id'>) => void;
  updateExpense: (expense: BudgetExpense) => void;
  deleteExpense: (id: string) => void;
  removeExpensesByTransaction: (transactionId: string) => void;
  getCategoryStatus: (categoryId: string) => CategoryBudgetStatus | undefined;
  getCategoriesStatus: () => CategoryBudgetStatus[];
  getCategoryById: (id: string) => BudgetCategory | undefined;
  getCurrentMonthExpenses: () => BudgetExpense[];
  addExpenseFromTransaction: (transactionId: string, categoryId: string, amount: number, description: string, date: string) => void;
  initializeDefaultCategories: () => void;
}

type BudgetAction =
  | { type: 'ADD_CATEGORY'; payload: BudgetCategory }
  | { type: 'UPDATE_CATEGORY'; payload: BudgetCategory }
  | { type: 'DELETE_CATEGORY'; payload: string }
  | { type: 'ADD_EXPENSE'; payload: BudgetExpense }
  | { type: 'UPDATE_EXPENSE'; payload: BudgetExpense }
  | { type: 'DELETE_EXPENSE'; payload: string }
  | { type: 'DELETE_EXPENSE_BY_TRANSACTION'; payload: string }
  | { type: 'LOAD_CATEGORIES'; payload: BudgetCategory[] }
  | { type: 'LOAD_EXPENSES'; payload: BudgetExpense[] }
  | { type: 'INITIALIZE_DEFAULT_CATEGORIES' };

const CATEGORIES_STORAGE_KEY = 'budget_categories';
const EXPENSES_STORAGE_KEY = 'budget_expenses';
const DIVISIONS_STORAGE_KEY = 'budget_divisions';

function saveCategoriesData(categories: BudgetCategory[]): void {
  try {
    localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(categories));
  } catch (error) {
    console.error('Erro ao salvar categorias:', error);
  }
}

function saveExpensesData(expenses: BudgetExpense[]): void {
  try {
    localStorage.setItem(EXPENSES_STORAGE_KEY, JSON.stringify(expenses));
  } catch (error) {
    console.error('Erro ao salvar despesas:', error);
  }
}

function saveDivisionsData(divisions: any[]): void {
  try {
    localStorage.setItem(DIVISIONS_STORAGE_KEY, JSON.stringify(divisions));
  } catch (error) {
    console.error('Erro ao salvar divisões:', error);
  }
}

function getCurrentMonthFilter(expenses: BudgetExpense[]): BudgetExpense[] {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  return expenses.filter(expense => {
    const expenseDate = new Date(expense.date);
    return expenseDate.getMonth() === currentMonth && 
           expenseDate.getFullYear() === currentYear;
  });
}

function budgetReducer(state: BudgetState, action: BudgetAction): BudgetState {
  let newCategories: BudgetCategory[];
  let newExpenses: BudgetExpense[];
  
  switch (action.type) {
    case 'ADD_CATEGORY':
      newCategories = [...state.categories, action.payload];
      saveCategoriesData(newCategories);
      return {
        ...state,
        categories: newCategories,
        summary: calculateBudgetSummary(newCategories, getCurrentMonthFilter(state.expenses))
      };

    case 'UPDATE_CATEGORY':
      newCategories = state.categories.map(cat =>
        cat.id === action.payload.id ? action.payload : cat
      );
      saveCategoriesData(newCategories);
      return {
        ...state,
        categories: newCategories,
        summary: calculateBudgetSummary(newCategories, getCurrentMonthFilter(state.expenses))
      };

    case 'DELETE_CATEGORY':
      newCategories = state.categories.filter(cat => cat.id !== action.payload);
      newExpenses = state.expenses.filter(exp => exp.categoryId !== action.payload);
      saveCategoriesData(newCategories);
      saveExpensesData(newExpenses);
      return {
        ...state,
        categories: newCategories,
        expenses: newExpenses,
        summary: calculateBudgetSummary(newCategories, getCurrentMonthFilter(newExpenses))
      };

    case 'ADD_EXPENSE':
      newExpenses = [...state.expenses, action.payload];
      saveExpensesData(newExpenses);
      return {
        ...state,
        expenses: newExpenses,
        summary: calculateBudgetSummary(state.categories, getCurrentMonthFilter(newExpenses))
      };

    case 'UPDATE_EXPENSE':
      newExpenses = state.expenses.map(exp =>
        exp.id === action.payload.id ? action.payload : exp
      );
      saveExpensesData(newExpenses);
      return {
        ...state,
        expenses: newExpenses,
        summary: calculateBudgetSummary(state.categories, getCurrentMonthFilter(newExpenses))
      };

    case 'DELETE_EXPENSE':
      newExpenses = state.expenses.filter(exp => exp.id !== action.payload);
      saveExpensesData(newExpenses);
      return {
        ...state,
        expenses: newExpenses,
        summary: calculateBudgetSummary(state.categories, getCurrentMonthFilter(newExpenses))
      };

    case 'DELETE_EXPENSE_BY_TRANSACTION':
      newExpenses = state.expenses.filter(exp => exp.transactionId !== action.payload);
      saveExpensesData(newExpenses);
      return {
        ...state,
        expenses: newExpenses,
        summary: calculateBudgetSummary(state.categories, getCurrentMonthFilter(newExpenses))
      };

    case 'LOAD_CATEGORIES':
      return {
        ...state,
        categories: action.payload,
        summary: calculateBudgetSummary(action.payload, getCurrentMonthFilter(state.expenses))
      };

    case 'LOAD_EXPENSES':
      return {
        ...state,
        expenses: action.payload,
        summary: calculateBudgetSummary(state.categories, getCurrentMonthFilter(action.payload))
      };

    case 'INITIALIZE_DEFAULT_CATEGORIES':
      const defaultCategories: BudgetCategory[] = DEFAULT_BUDGET_CATEGORIES.map((cat, index) => ({
        id: crypto.randomUUID(),
        name: cat.name,
        monthlyLimit: 0,
        description: cat.description,
        icon: cat.icon,
        color: cat.color,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));

      saveCategoriesData(defaultCategories);
      return {
        ...state,
        categories: defaultCategories,
        summary: calculateBudgetSummary(defaultCategories, getCurrentMonthFilter(state.expenses))
      };
      
    default:
      return state;
  }
}

const initialState: BudgetState = {
  categories: [],
  expenses: [],
  summary: {
    totalBudget: 0,
    totalSpent: 0,
    totalRemaining: 0,
    percentUsed: 0,
    categoriesCount: 0,
    categoriesOk: 0,
    categoriesWarning: 0,
    categoriesExceeded: 0
  }
};

const BudgetContext = createContext<BudgetContextType | undefined>(undefined);

export function BudgetProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(budgetReducer, initialState);
  const [defaultDivisionId, setDefaultDivisionId] = useState<string | null>(null);
  const { isAuthenticated, user } = useAuth();

  // Carregar dados da API quando autenticado ou do localStorage em modo demo
  useEffect(() => {
    if (isAuthenticated && user) {
      loadBudgetData();
    } else if (!user && state.categories.length === 0) {
      // Em modo demo, tentar carregar do localStorage
      try {
        const savedCategoriesStr = localStorage.getItem(CATEGORIES_STORAGE_KEY);
        const savedExpensesStr = localStorage.getItem(EXPENSES_STORAGE_KEY);
        const savedDivisionsStr = localStorage.getItem(DIVISIONS_STORAGE_KEY);

        if (savedCategoriesStr && savedCategoriesStr.trim()) {
          try {
            const savedCategories = JSON.parse(savedCategoriesStr) as BudgetCategory[];
            if (Array.isArray(savedCategories)) {
              dispatch({ type: 'LOAD_CATEGORIES', payload: savedCategories });
            }
          } catch (e) {
            console.warn('Erro ao parsear categorias:', e);
          }
        }
        if (savedExpensesStr && savedExpensesStr.trim()) {
          try {
            const savedExpenses = JSON.parse(savedExpensesStr) as BudgetExpense[];
            if (Array.isArray(savedExpenses)) {
              dispatch({ type: 'LOAD_EXPENSES', payload: savedExpenses });
            }
          } catch (e) {
            console.warn('Erro ao parsear despesas:', e);
          }
        }
        if (savedDivisionsStr && savedDivisionsStr.trim()) {
          try {
            const savedDivisions = JSON.parse(savedDivisionsStr) as any[];
            if (Array.isArray(savedDivisions) && savedDivisions.length > 0) {
              setDefaultDivisionId(savedDivisions[0].id);
            }
          } catch (e) {
            console.warn('Erro ao parsear divisões:', e);
          }
        }
      } catch (error) {
        console.error('Erro ao carregar dados do localStorage:', error);
      }
    }
  }, [isAuthenticated, user, state.categories.length]);

  const loadBudgetData = async () => {
    try {
      const [divisions, budgetCategories] = await Promise.all([
        supabaseService.getBudgetDivisions(),
        supabaseService.getBudgetCategories()
      ]);

      let divisionId = divisions && divisions.length > 0 ? divisions[0].id : null;
      if (!divisionId) {
        const created = await supabaseService.createBudgetDivision({
          name: 'Pessoal',
          percentage: 100,
          color: '#3B82F6',
          sort_order: 0
        } as any);
        divisionId = created.id;
      }
      setDefaultDivisionId(divisionId);
      saveDivisionsData(divisions || [{ id: divisionId, name: 'Pessoal' }]);

      const savedCategoriesStr = localStorage.getItem(CATEGORIES_STORAGE_KEY);
      const savedExpensesStr = localStorage.getItem(EXPENSES_STORAGE_KEY);

      let savedCategories = null;
      let savedExpenses = null;

      try {
        savedCategories = savedCategoriesStr && savedCategoriesStr.trim() ? JSON.parse(savedCategoriesStr) : null;
      } catch (error) {
        console.warn('Erro ao parsear categorias salvas:', error);
        savedCategories = null;
      }

      try {
        savedExpenses = savedExpensesStr && savedExpensesStr.trim() ? JSON.parse(savedExpensesStr) : null;
      } catch (error) {
        console.warn('Erro ao parsear despesas salvas:', error);
        savedExpenses = null;
      }

      if (budgetCategories && budgetCategories.length > 0) {
        const mapped = budgetCategories.map((c: any): BudgetCategory => ({
          id: c.id,
          name: c.name,
          monthlyLimit: 0,
          description: undefined,
          icon: c.icon || undefined,
          color: c.color || undefined,
          createdAt: c.created_at,
          updatedAt: c.updated_at
        }));
        dispatch({ type: 'LOAD_CATEGORIES', payload: mapped });
        saveCategoriesData(mapped);
      } else if (savedCategories && Array.isArray(savedCategories) && savedCategories.length > 0 && divisionId) {
        try {
          await Promise.all(savedCategories.map(cat => supabaseService.createBudgetCategory({
            division_id: divisionId!,
            name: cat.name,
            allocated_amount: 0,
            percentage: 0,
            icon: cat.icon,
            color: cat.color
          } as any)));
          const after = await supabaseService.getBudgetCategories();
          const mapped = after.map((c: any): BudgetCategory => ({
            id: c.id,
            name: c.name,
            monthlyLimit: 0,
            description: undefined,
            icon: c.icon || undefined,
            color: c.color || undefined,
            createdAt: c.created_at,
            updatedAt: c.updated_at
          }));
          dispatch({ type: 'LOAD_CATEGORIES', payload: mapped });
          saveCategoriesData(mapped);
        } catch (e) {
          console.warn('Erro ao sincronizar categorias com Supabase, usando localStorage:', e);
          dispatch({ type: 'LOAD_CATEGORIES', payload: savedCategories });
        }
      } else {
        dispatch({ type: 'LOAD_CATEGORIES', payload: [] });
      }

      if (savedExpenses && Array.isArray(savedExpenses)) {
        dispatch({ type: 'LOAD_EXPENSES', payload: savedExpenses });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
      console.error('Erro ao carregar dados de orçamento:', errorMessage);
      try {
        const categoriesStr = localStorage.getItem(CATEGORIES_STORAGE_KEY);
        const expensesStr = localStorage.getItem(EXPENSES_STORAGE_KEY);

        if (categoriesStr) {
          const categories = JSON.parse(categoriesStr) as BudgetCategory[];
          if (Array.isArray(categories)) {
            dispatch({ type: 'LOAD_CATEGORIES', payload: categories });
          }
        }
        if (expensesStr) {
          const expenses = JSON.parse(expensesStr) as BudgetExpense[];
          if (Array.isArray(expenses)) {
            dispatch({ type: 'LOAD_EXPENSES', payload: expenses });
          }
        }
      } catch (fallbackError) {
        console.error('Erro ao carregar dados de orçamento do fallback:', fallbackError);
      }
    }
  };

  const addCategory = useCallback((categoryData: Omit<BudgetCategory, 'id' | 'createdAt' | 'updatedAt'>) => {
    (async () => {
      try {
        let divisionId = defaultDivisionId;
        if (!divisionId) {
          const created = await supabaseService.createBudgetDivision({
            name: 'Pessoal',
            percentage: 100,
            color: '#3B82F6',
            description: 'Divisão padrão',
            sort_order: 0
          } as any);
          divisionId = created.id;
          setDefaultDivisionId(divisionId);
        }
        const createdCat = await supabaseService.createBudgetCategory({
          division_id: divisionId!,
          name: categoryData.name,
          allocated_amount: 0,
          percentage: 0,
          icon: categoryData.icon,
          color: categoryData.color
        } as any);
        const category: BudgetCategory = {
          id: createdCat.id,
          name: createdCat.name,
          monthlyLimit: categoryData.monthlyLimit,
          description: categoryData.description,
          icon: createdCat.icon || categoryData.icon,
          color: createdCat.color || categoryData.color,
          createdAt: createdCat.created_at,
          updatedAt: createdCat.updated_at
        };
        dispatch({ type: 'ADD_CATEGORY', payload: category });
      } catch (e) {
        console.warn('Falha ao criar categoria na Supabase, salvando localmente:', e);
        const local: BudgetCategory = {
          ...categoryData,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        dispatch({ type: 'ADD_CATEGORY', payload: local });
      }
    })();
  }, [defaultDivisionId]);

  const updateCategory = useCallback((category: BudgetCategory) => {
    (async () => {
      try {
        // Only update fields that exist in the budget_categories table
        await supabaseService.updateBudgetCategory(category.id, {
          name: category.name
        } as any);
      } catch (e) {
        console.warn('Falha ao atualizar categoria na Supabase, atualizando localmente:', e);
      }
      const updatedCategory = {
        ...category,
        updatedAt: new Date().toISOString()
      };
      dispatch({ type: 'UPDATE_CATEGORY', payload: updatedCategory });
    })();
  }, []);

  const deleteCategory = useCallback((id: string) => {
    (async () => {
      try {
        await supabaseService.deleteBudgetCategory(id);
      } catch (e) {
        console.warn('Falha ao deletar categoria na Supabase, removendo localmente:', e);
      }
      dispatch({ type: 'DELETE_CATEGORY', payload: id });
    })();
  }, []);

  const addExpense = useCallback((expenseData: Omit<BudgetExpense, 'id'>) => {
    const expense: BudgetExpense = {
      ...expenseData,
      id: crypto.randomUUID()
    };
    
    dispatch({ type: 'ADD_EXPENSE', payload: expense });
  }, []);

  const updateExpense = useCallback((expense: BudgetExpense) => {
    dispatch({ type: 'UPDATE_EXPENSE', payload: expense });
  }, []);

  const deleteExpense = useCallback((id: string) => {
    dispatch({ type: 'DELETE_EXPENSE', payload: id });
  }, []);

  const removeExpensesByTransaction = useCallback((transactionId: string) => {
    dispatch({ type: 'DELETE_EXPENSE_BY_TRANSACTION', payload: transactionId });
  }, []);

  const getCategoryStatus = useCallback((categoryId: string): CategoryBudgetStatus | undefined => {
    const category = state.categories.find(cat => cat.id === categoryId);
    if (!category) return undefined;
    
    const currentMonthExpenses = getCurrentMonthFilter(state.expenses);
    return calculateCategoryStatus(category, currentMonthExpenses);
  }, [state.categories, state.expenses]);

  const getCategoriesStatus = useCallback((): CategoryBudgetStatus[] => {
    const currentMonthExpenses = getCurrentMonthFilter(state.expenses);
    return state.categories.map(category => 
      calculateCategoryStatus(category, currentMonthExpenses)
    );
  }, [state.categories, state.expenses]);

  const getCategoryById = useCallback((id: string) => {
    return state.categories.find(cat => cat.id === id);
  }, [state.categories]);

  const getCurrentMonthExpenses = useCallback(() => {
    return getCurrentMonthFilter(state.expenses);
  }, [state.expenses]);

  const addExpenseFromTransaction = useCallback((
    transactionId: string,
    categoryId: string,
    amount: number,
    description: string,
    date: string
  ) => {
    addExpense({
      categoryId,
      amount,
      description,
      date,
      transactionId
    });
  }, [addExpense]);

  const initializeDefaultCategories = useCallback(() => {
    dispatch({ type: 'INITIALIZE_DEFAULT_CATEGORIES' });
  }, []);

  const value: BudgetContextType = {
    ...state,
    addCategory,
    updateCategory,
    deleteCategory,
    addExpense,
    updateExpense,
    deleteExpense,
    removeExpensesByTransaction,
    getCategoryStatus,
    getCategoriesStatus,
    getCategoryById,
    getCurrentMonthExpenses,
    addExpenseFromTransaction,
    initializeDefaultCategories
  };

  return (
    <BudgetContext.Provider value={value}>
      {children}
    </BudgetContext.Provider>
  );
}

export function useBudget() {
  const context = useContext(BudgetContext);
  if (!context) {
    throw new Error('useBudget deve ser usado dentro de BudgetProvider');
  }
  return context;
}
