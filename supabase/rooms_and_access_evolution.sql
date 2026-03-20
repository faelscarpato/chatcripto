-- ETAPA: EVOLUCAO DE SALAS E PERSISTENCIA DE ACESSO
-- Objetivo: manter a base antiga compativel e preparar acesso persistente, favoritos e ownership.

ALTER TABLE public.rooms
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Geral',
ADD COLUMN IF NOT EXISTS require_password_every_time BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS password_verifier TEXT,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

CREATE TABLE IF NOT EXISTS public.room_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  is_favorite BOOLEAN DEFAULT false,
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT room_access_user_room_unique UNIQUE(user_id, room_id),
  CONSTRAINT room_access_role_check CHECK (role IN ('owner', 'member'))
);

ALTER TABLE public.room_access
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'member',
ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT now();

UPDATE public.room_access
SET role = 'member'
WHERE role IS NULL;

UPDATE public.room_access
SET is_favorite = false
WHERE is_favorite IS NULL;

UPDATE public.room_access
SET last_seen_at = COALESCE(last_seen_at, created_at, now())
WHERE last_seen_at IS NULL;

ALTER TABLE public.room_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own access" ON public.room_access;
CREATE POLICY "Users can view their own access" ON public.room_access
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own access" ON public.room_access;
CREATE POLICY "Users can insert their own access" ON public.room_access
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own access" ON public.room_access;
CREATE POLICY "Users can update their own access" ON public.room_access
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.room_access IS
'Registra ownership, favoritos e ultima visualizacao das salas liberadas para cada usuario.';
