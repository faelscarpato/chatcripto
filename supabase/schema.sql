-- 1. Tabelas Base
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  encrypted_content TEXT NOT NULL,
  iv TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Colunas Adicionais com Valores Padrão para evitar quebra de RLS
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS age_group TEXT CHECK (age_group IN ('Livre', '+18'));
UPDATE public.profiles SET age_group = 'Livre' WHERE age_group IS NULL;
ALTER TABLE public.profiles ALTER COLUMN age_group SET DEFAULT 'Livre';
ALTER TABLE public.profiles ALTER COLUMN age_group SET NOT NULL;

ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS age_group TEXT CHECK (age_group IN ('Livre', '+18'));
UPDATE public.rooms SET age_group = 'Livre' WHERE age_group IS NULL;
ALTER TABLE public.rooms ALTER COLUMN age_group SET DEFAULT 'Livre';
ALTER TABLE public.rooms ALTER COLUMN age_group SET NOT NULL;

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_view_once BOOLEAN DEFAULT false;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS media_id TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS media_type TEXT;

-- 2.1 Storage para midias efemeras
INSERT INTO storage.buckets (id, name, public)
VALUES ('ephemeral-media', 'ephemeral-media', false)
ON CONFLICT (id) DO NOTHING;

-- 3. Habilitar RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de Perfis
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 5. Políticas de Salas (Baseadas em age_group)
DROP POLICY IF EXISTS "Rooms are viewable by users in the same age group" ON public.rooms;
CREATE POLICY "Rooms are viewable by users in the same age group" ON public.rooms FOR SELECT 
USING (
  age_group = (SELECT COALESCE(age_group, 'Livre') FROM public.profiles WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Authenticated users can create rooms" ON public.rooms;
CREATE POLICY "Authenticated users can create rooms" ON public.rooms FOR INSERT 
WITH CHECK (
  auth.role() = 'authenticated' AND 
  age_group = (SELECT COALESCE(age_group, 'Livre') FROM public.profiles WHERE id = auth.uid())
);

-- 6. Políticas de Mensagens
-- Simplificada para garantir que se o usuário pode VER a sala, ele pode VER/INSERIR mensagens
DROP POLICY IF EXISTS "Messages are viewable by authenticated users" ON public.messages;
CREATE POLICY "Messages are viewable by authenticated users" ON public.messages FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.rooms r
    WHERE r.id = room_id -- A política de SELECT da sala já filtra por age_group
  )
);

DROP POLICY IF EXISTS "Authenticated users can insert messages" ON public.messages;
CREATE POLICY "Authenticated users can insert messages" ON public.messages FOR INSERT 
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM public.rooms r
    WHERE r.id = room_id
  )
);

DROP POLICY IF EXISTS "Authenticated users can delete view-once messages" ON public.messages;
CREATE POLICY "Authenticated users can delete view-once messages" ON public.messages FOR DELETE
USING (
  is_view_once = true AND
  EXISTS (
    SELECT 1 FROM public.rooms r
    WHERE r.id = room_id
  )
);

-- 6.1 Politicas do Storage
DROP POLICY IF EXISTS "Authenticated users can upload ephemeral media" ON storage.objects;
CREATE POLICY "Authenticated users can upload ephemeral media" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'ephemeral-media' AND
  EXISTS (
    SELECT 1 FROM public.rooms r
    WHERE r.id::text = split_part(name, '/', 1)
  )
);

DROP POLICY IF EXISTS "Authenticated users can read ephemeral media" ON storage.objects;
CREATE POLICY "Authenticated users can read ephemeral media" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'ephemeral-media' AND
  EXISTS (
    SELECT 1 FROM public.rooms r
    WHERE r.id::text = split_part(name, '/', 1)
  )
);

DROP POLICY IF EXISTS "Authenticated users can delete ephemeral media" ON storage.objects;
CREATE POLICY "Authenticated users can delete ephemeral media" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'ephemeral-media' AND
  EXISTS (
    SELECT 1 FROM public.rooms r
    WHERE r.id::text = split_part(name, '/', 1)
  )
);

-- 7. Funções e Triggers
CREATE OR REPLACE FUNCTION delete_old_messages() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM public.messages WHERE created_at < NOW() - INTERVAL '20 minutes' AND is_view_once = false;
  DELETE FROM public.messages WHERE created_at < NOW() - INTERVAL '24 hours' AND is_view_once = true;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS cleanup_messages_trigger ON public.messages;
CREATE TRIGGER cleanup_messages_trigger AFTER INSERT ON public.messages
FOR EACH STATEMENT EXECUTE FUNCTION delete_old_messages();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username, avatar_url, age_group, full_name, cpf, birth_date, address)
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
