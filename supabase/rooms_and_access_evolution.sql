-- ETAPA: EVOLUÇÃO DE SALAS E PERSISTÊNCIA DE ACESSO
-- Objetivo: Adicionar categorias às salas e permitir que usuários entrem sem redigitar a senha se já tiverem acesso.

-- 1. Adicionar campos de Categoria e Configuração de Senha na tabela de salas
ALTER TABLE public.rooms 
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Geral',
ADD COLUMN IF NOT EXISTS require_password_every_time BOOLEAN DEFAULT false;

-- 2. Criar Tabela de Acesso Persistente (Controle de quem já entrou em qual sala)
CREATE TABLE IF NOT EXISTS public.room_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, room_id)
);

-- 3. Habilitar RLS na tabela de acessos
ALTER TABLE public.room_access ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de Segurança para Room Access
DROP POLICY IF EXISTS "Users can view their own access" ON public.room_access;
CREATE POLICY "Users can view their own access" ON public.room_access
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own access" ON public.room_access;
CREATE POLICY "Users can insert their own access" ON public.room_access
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 5. Comentário Informativo
COMMENT ON TABLE public.room_access IS 'Registra o histórico de salas acessadas por cada usuário para permitir a reentrada simplificada.';
