-- ==============================================================================
-- 1. ENUMS (Tipos Personalizados)
-- ==============================================================================

CREATE TYPE transaction_type AS ENUM ('income', 'expense');
CREATE TYPE transaction_status AS ENUM ('pending', 'paid', 'late', 'cancelled');
CREATE TYPE goal_status AS ENUM ('active', 'completed', 'failed', 'paused');

-- ==============================================================================
-- 2. TABELAS PRINCIPAIS
-- ==============================================================================

-- 2.1 Profiles (Perfil do Usuário, vinculado ao auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2.2 Financial Settings (Configurações financeiras gerais do usuário)
CREATE TABLE public.financial_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  currency TEXT DEFAULT 'BRL' NOT NULL,
  monthly_budget_limit NUMERIC(15, 2) DEFAULT 0.00,
  emergency_fund_target NUMERIC(15, 2) DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id) -- Apenas uma configuração por usuário
);

-- 2.3 Categories (Categorias de Receitas/Despesas)
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  icon TEXT,
  type transaction_type NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2.4 Payment Methods (Formas de Pagamento/Contas/Cartões)
CREATE TABLE public.payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- ex: 'credit_card', 'bank_account', 'cash'
  current_balance NUMERIC(15, 2) DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2.5 Financial Transactions (Movimentações: Receitas e Despesas)
CREATE TABLE public.financial_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  payment_method_id UUID REFERENCES public.payment_methods(id) ON DELETE SET NULL,
  amount NUMERIC(15, 2) NOT NULL,
  type transaction_type NOT NULL,
  status transaction_status DEFAULT 'pending' NOT NULL,
  description TEXT NOT NULL,
  due_date DATE NOT NULL,
  paid_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2.6 Debts (Dívidas de longo prazo/Empréstimos)
CREATE TABLE public.debts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  total_amount NUMERIC(15, 2) NOT NULL,
  remaining_amount NUMERIC(15, 2) NOT NULL,
  interest_rate NUMERIC(5, 2) DEFAULT 0.00,
  due_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2.7 Goals (Metas Financeiras/Pessoais)
CREATE TABLE public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_amount NUMERIC(15, 2) NOT NULL,
  current_amount NUMERIC(15, 2) DEFAULT 0.00 NOT NULL,
  status goal_status DEFAULT 'active' NOT NULL,
  deadline DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2.8 Goal Updates (Histórico de aportes nas metas)
CREATE TABLE public.goal_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  goal_id UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  amount_added NUMERIC(15, 2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2.9 Savings Entries (Histórico geral de dinheiro guardado livre)
CREATE TABLE public.savings_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount NUMERIC(15, 2) NOT NULL,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2.10 Emergency Fund Entries (Histórico da reserva de emergência)
CREATE TABLE public.emergency_fund_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount NUMERIC(15, 2) NOT NULL, -- Positivo (aporte) ou Negativo (resgate)
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2.11 Investments (Carteiras de Investimentos)
CREATE TABLE public.investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- ex: 'CDB', 'Ações', 'FIIs', 'Cripto'
  broker TEXT, -- Corretora
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2.12 Investment Entries (Aportes, rendimentos ou retiradas)
CREATE TABLE public.investment_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  investment_id UUID NOT NULL REFERENCES public.investments(id) ON DELETE CASCADE,
  amount NUMERIC(15, 2) NOT NULL,
  type TEXT NOT NULL, -- ex: 'contribution' (aporte), 'withdrawal' (retirada), 'yield' (rendimento)
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- 3. HABILITANDO ROW LEVEL SECURITY (RLS)
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.savings_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_fund_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investment_entries ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- 4. POLICIES DE SEGURANÇA (O usuário só vê/edita o que for dele)
-- ==============================================================================

-- Profiles: Usuário pode ler e atualizar seu próprio perfil
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Para todas as outras tabelas que usam user_id, criamos as policies de CRUD completas
-- Função auxiliar para gerar policies repetitivas não é nativa, então definiremos explicitamente:

-- financial_settings
CREATE POLICY "Users can manage own financial_settings" ON public.financial_settings FOR ALL USING (auth.uid() = user_id);

-- categories
CREATE POLICY "Users can manage own categories" ON public.categories FOR ALL USING (auth.uid() = user_id);

-- payment_methods
CREATE POLICY "Users can manage own payment_methods" ON public.payment_methods FOR ALL USING (auth.uid() = user_id);

-- financial_transactions
CREATE POLICY "Users can manage own financial_transactions" ON public.financial_transactions FOR ALL USING (auth.uid() = user_id);

-- debts
CREATE POLICY "Users can manage own debts" ON public.debts FOR ALL USING (auth.uid() = user_id);

-- goals
CREATE POLICY "Users can manage own goals" ON public.goals FOR ALL USING (auth.uid() = user_id);

-- goal_updates
CREATE POLICY "Users can manage own goal_updates" ON public.goal_updates FOR ALL USING (auth.uid() = user_id);

-- savings_entries
CREATE POLICY "Users can manage own savings_entries" ON public.savings_entries FOR ALL USING (auth.uid() = user_id);

-- emergency_fund_entries
CREATE POLICY "Users can manage own emergency_fund_entries" ON public.emergency_fund_entries FOR ALL USING (auth.uid() = user_id);

-- investments
CREATE POLICY "Users can manage own investments" ON public.investments FOR ALL USING (auth.uid() = user_id);

-- investment_entries
CREATE POLICY "Users can manage own investment_entries" ON public.investment_entries FOR ALL USING (auth.uid() = user_id);

-- ==============================================================================
-- 5. TRIGGER PARA CRIAR PROFILE AUTOMATICAMENTE AO CADASTRAR NO AUTH
-- ==============================================================================

-- Esta trigger pega o usuário recém criado na autenticação do Supabase e já cria uma linha em public.profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'name', 'Usuário'));
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger disparada sempre que um usuário é inserido em auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();