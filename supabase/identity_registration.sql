-- ETAPA: CADASTRO DE IDENTIDADE REAL (KYC)
-- Objetivo: Armazenar dados civis dos usuários para conformidade e segurança.

-- 1. Adicionar as colunas de identidade real à tabela de perfis
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS full_name TEXT,
ADD COLUMN IF NOT EXISTS cpf TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS birth_date DATE,
ADD COLUMN IF NOT EXISTS address TEXT;

-- 2. Atualizar a função handle_new_user para processar os novos campos
-- Esta função é disparada automaticamente sempre que um novo usuário se registra via Auth.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (
    id, 
    username, 
    avatar_url, 
    age_group, 
    full_name, 
    cpf, 
    birth_date, 
    address
  )
  VALUES (
    new.id, 
    split_part(new.email, '@', 1), 
    '', 
    COALESCE(new.raw_user_meta_data->>'age_group', 'Livre'),
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'cpf',
    (new.raw_user_meta_data->>'birth_date')::DATE,
    new.raw_user_meta_data->>'address'
  )
  ON CONFLICT (id) DO UPDATE SET
    age_group = EXCLUDED.age_group,
    full_name = EXCLUDED.full_name,
    cpf = EXCLUDED.cpf,
    birth_date = EXCLUDED.birth_date,
    address = EXCLUDED.address;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Garantir que o Trigger esteja ativo
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
