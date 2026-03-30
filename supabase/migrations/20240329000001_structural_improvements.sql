-- ==============================================================================
-- 1. FUNÇÃO PARA ATUALIZAR O UPDATED_AT AUTOMATICAMENTE
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- 2. TRIGGERS DE UPDATED_AT NAS TABELAS EXISTENTES
-- ==============================================================================

-- profiles
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- financial_settings
DROP TRIGGER IF EXISTS update_financial_settings_updated_at ON public.financial_settings;
CREATE TRIGGER update_financial_settings_updated_at
  BEFORE UPDATE ON public.financial_settings
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- categories
DROP TRIGGER IF EXISTS update_categories_updated_at ON public.categories;
CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- payment_methods
DROP TRIGGER IF EXISTS update_payment_methods_updated_at ON public.payment_methods;
CREATE TRIGGER update_payment_methods_updated_at
  BEFORE UPDATE ON public.payment_methods
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- financial_transactions
DROP TRIGGER IF EXISTS update_financial_transactions_updated_at ON public.financial_transactions;
CREATE TRIGGER update_financial_transactions_updated_at
  BEFORE UPDATE ON public.financial_transactions
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- debts
DROP TRIGGER IF EXISTS update_debts_updated_at ON public.debts;
CREATE TRIGGER update_debts_updated_at
  BEFORE UPDATE ON public.debts
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- goals
DROP TRIGGER IF EXISTS update_goals_updated_at ON public.goals;
CREATE TRIGGER update_goals_updated_at
  BEFORE UPDATE ON public.goals
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- goal_updates
DROP TRIGGER IF EXISTS update_goal_updates_updated_at ON public.goal_updates;
CREATE TRIGGER update_goal_updates_updated_at
  BEFORE UPDATE ON public.goal_updates
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- savings_entries
DROP TRIGGER IF EXISTS update_savings_entries_updated_at ON public.savings_entries;
CREATE TRIGGER update_savings_entries_updated_at
  BEFORE UPDATE ON public.savings_entries
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- emergency_fund_entries
DROP TRIGGER IF EXISTS update_emergency_fund_entries_updated_at ON public.emergency_fund_entries;
CREATE TRIGGER update_emergency_fund_entries_updated_at
  BEFORE UPDATE ON public.emergency_fund_entries
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- investments
DROP TRIGGER IF EXISTS update_investments_updated_at ON public.investments;
CREATE TRIGGER update_investments_updated_at
  BEFORE UPDATE ON public.investments
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- investment_entries
DROP TRIGGER IF EXISTS update_investment_entries_updated_at ON public.investment_entries;
CREATE TRIGGER update_investment_entries_updated_at
  BEFORE UPDATE ON public.investment_entries
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- ==============================================================================
-- 3. ÍNDICES DE PERFORMANCE (USER_ID E FOREIGN KEYS)
-- ==============================================================================

-- financial_settings
CREATE INDEX IF NOT EXISTS idx_financial_settings_user_id ON public.financial_settings(user_id);

-- categories
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON public.categories(user_id);

-- payment_methods
CREATE INDEX IF NOT EXISTS idx_payment_methods_user_id ON public.payment_methods(user_id);

-- financial_transactions
CREATE INDEX IF NOT EXISTS idx_financial_transactions_user_id ON public.financial_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_category_id ON public.financial_transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_payment_method_id ON public.financial_transactions(payment_method_id);

-- debts
CREATE INDEX IF NOT EXISTS idx_debts_user_id ON public.debts(user_id);

-- goals
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON public.goals(user_id);

-- goal_updates
CREATE INDEX IF NOT EXISTS idx_goal_updates_user_id ON public.goal_updates(user_id);
CREATE INDEX IF NOT EXISTS idx_goal_updates_goal_id ON public.goal_updates(goal_id);

-- savings_entries
CREATE INDEX IF NOT EXISTS idx_savings_entries_user_id ON public.savings_entries(user_id);

-- emergency_fund_entries
CREATE INDEX IF NOT EXISTS idx_emergency_fund_entries_user_id ON public.emergency_fund_entries(user_id);

-- investments
CREATE INDEX IF NOT EXISTS idx_investments_user_id ON public.investments(user_id);

-- investment_entries
CREATE INDEX IF NOT EXISTS idx_investment_entries_user_id ON public.investment_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_investment_entries_investment_id ON public.investment_entries(investment_id);

-- ==============================================================================
-- 4. AJUSTES DE CAMPOS (REMOVER NOT NULL DE DESCRIPTION EM TRANSACTIONS)
-- ==============================================================================

ALTER TABLE public.financial_transactions ALTER COLUMN description DROP NOT NULL;
