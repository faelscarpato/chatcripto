-- 1. Tabelas base
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  profile_emoji TEXT DEFAULT '🙂',
  age_group TEXT DEFAULT 'Livre' CHECK (age_group IN ('Livre', '+18')),
  full_name TEXT,
  cpf TEXT UNIQUE,
  birth_date DATE,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  age_group TEXT DEFAULT 'Livre' CHECK (age_group IN ('Livre', '+18')),
  category TEXT DEFAULT 'Geral',
  visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'unlisted', 'personal')),
  message_ttl_minutes INTEGER DEFAULT 20 CHECK (message_ttl_minutes IN (5, 10, 15, 20)),
  require_password_every_time BOOLEAN DEFAULT false,
  password_verifier TEXT,
  created_by UUID REFERENCES auth.users(id),
  is_archived BOOLEAN DEFAULT false,
  last_activity_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.room_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  is_favorite BOOLEAN DEFAULT false,
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, room_id)
);

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  encrypted_content TEXT NOT NULL,
  iv TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  message_type TEXT DEFAULT 'user' CHECK (message_type IN ('user', 'system')),
  metadata JSONB,
  is_view_once BOOLEAN DEFAULT false,
  media_id TEXT,
  media_type TEXT,
  media_view_mode TEXT CHECK (media_view_mode IN ('once', '30s')),
  media_view_seconds INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Backfill incremental para bases antigas
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS age_group TEXT CHECK (age_group IN ('Livre', '+18'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_emoji TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cpf TEXT UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address TEXT;
UPDATE public.profiles SET age_group = 'Livre' WHERE age_group IS NULL;
UPDATE public.profiles SET profile_emoji = '🙂' WHERE profile_emoji IS NULL OR profile_emoji = '';
ALTER TABLE public.profiles ALTER COLUMN age_group SET DEFAULT 'Livre';
ALTER TABLE public.profiles ALTER COLUMN age_group SET NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN profile_emoji SET DEFAULT '🙂';
ALTER TABLE public.profiles ALTER COLUMN profile_emoji SET NOT NULL;

ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS age_group TEXT CHECK (age_group IN ('Livre', '+18'));
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Geral';
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'unlisted', 'personal'));
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS message_ttl_minutes INTEGER DEFAULT 20 CHECK (message_ttl_minutes IN (5, 10, 15, 20));
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS require_password_every_time BOOLEAN DEFAULT false;
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS password_verifier TEXT;
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ DEFAULT now();
UPDATE public.rooms SET age_group = 'Livre' WHERE age_group IS NULL;
UPDATE public.rooms SET visibility = 'public' WHERE visibility IS NULL;
UPDATE public.rooms SET message_ttl_minutes = 20 WHERE message_ttl_minutes IS NULL;
UPDATE public.rooms SET is_archived = false WHERE is_archived IS NULL;
UPDATE public.rooms SET last_activity_at = COALESCE(last_activity_at, created_at, now()) WHERE last_activity_at IS NULL;
ALTER TABLE public.rooms ALTER COLUMN age_group SET DEFAULT 'Livre';
ALTER TABLE public.rooms ALTER COLUMN age_group SET NOT NULL;
ALTER TABLE public.rooms ALTER COLUMN visibility SET DEFAULT 'public';
ALTER TABLE public.rooms ALTER COLUMN message_ttl_minutes SET DEFAULT 20;
ALTER TABLE public.rooms ALTER COLUMN is_archived SET DEFAULT false;

ALTER TABLE public.room_access ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'member'));
ALTER TABLE public.room_access ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT false;
ALTER TABLE public.room_access ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT now();
UPDATE public.room_access SET role = 'member' WHERE role IS NULL;
UPDATE public.room_access SET is_favorite = false WHERE is_favorite IS NULL;
UPDATE public.room_access SET last_seen_at = COALESCE(last_seen_at, created_at, now()) WHERE last_seen_at IS NULL;

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'user' CHECK (message_type IN ('user', 'system'));
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS metadata JSONB;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_view_once BOOLEAN DEFAULT false;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS media_id TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS media_type TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS media_view_mode TEXT CHECK (media_view_mode IN ('once', '30s'));
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS media_view_seconds INTEGER;
UPDATE public.messages
SET expires_at = created_at + make_interval(mins => 20)
WHERE expires_at IS NULL
  AND is_view_once = false;
UPDATE public.messages
SET expires_at = created_at + interval '24 hours'
WHERE expires_at IS NULL
  AND is_view_once = true;

-- 2.1 Storage para midias efemeras
INSERT INTO storage.buckets (id, name, public)
VALUES ('ephemeral-media', 'ephemeral-media', false)
ON CONFLICT (id) DO NOTHING;

-- 3. Indices
CREATE INDEX IF NOT EXISTS rooms_created_by_idx ON public.rooms(created_by);
CREATE INDEX IF NOT EXISTS rooms_visibility_created_at_idx ON public.rooms(visibility, created_at DESC);
CREATE INDEX IF NOT EXISTS rooms_last_activity_idx ON public.rooms(last_activity_at DESC);
CREATE INDEX IF NOT EXISTS room_access_user_last_seen_idx ON public.room_access(user_id, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS messages_room_expires_idx ON public.messages(room_id, expires_at);

-- 4. Habilitar RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 5. Politicas de perfis
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles
FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
FOR UPDATE USING (auth.uid() = id);

-- 6. Politicas de salas
DROP POLICY IF EXISTS "Rooms are viewable by users in the same age group" ON public.rooms;
CREATE POLICY "Rooms are viewable by users in the same age group" ON public.rooms
FOR SELECT USING (
  age_group = (SELECT COALESCE(age_group, 'Livre') FROM public.profiles WHERE id = auth.uid())
  AND (
    created_by = auth.uid()
    OR visibility = 'public'
    OR visibility = 'unlisted'
    OR (
      visibility = 'personal'
      AND created_by = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Authenticated users can create rooms" ON public.rooms;
CREATE POLICY "Authenticated users can create rooms" ON public.rooms
FOR INSERT WITH CHECK (
  auth.role() = 'authenticated'
  AND created_by = auth.uid()
  AND age_group = (SELECT COALESCE(age_group, 'Livre') FROM public.profiles WHERE id = auth.uid())
  AND password_verifier IS NOT NULL
);

DROP POLICY IF EXISTS "Room creators can update their own rooms" ON public.rooms;
CREATE POLICY "Room creators can update their own rooms" ON public.rooms
FOR UPDATE USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Room creators can delete their own rooms" ON public.rooms;
CREATE POLICY "Room creators can delete their own rooms" ON public.rooms
FOR DELETE USING (created_by = auth.uid());

-- 7. Politicas de room_access
DROP POLICY IF EXISTS "Users can view their own access" ON public.room_access;
CREATE POLICY "Users can view their own access" ON public.room_access
FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own access" ON public.room_access;
CREATE POLICY "Users can insert their own access" ON public.room_access
FOR INSERT WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.rooms r
    WHERE r.id = room_id
  )
);

DROP POLICY IF EXISTS "Users can update their own access" ON public.room_access;
CREATE POLICY "Users can update their own access" ON public.room_access
FOR UPDATE USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 8. Politicas de mensagens
DROP POLICY IF EXISTS "Messages are viewable by authenticated users" ON public.messages;
CREATE POLICY "Messages are viewable by authenticated users" ON public.messages
FOR SELECT USING (
  EXISTS (
    SELECT 1
    FROM public.rooms r
    WHERE r.id = room_id
  )
);

DROP POLICY IF EXISTS "Authenticated users can insert messages" ON public.messages;
CREATE POLICY "Authenticated users can insert messages" ON public.messages
FOR INSERT WITH CHECK (
  auth.uid() = user_id
  AND expires_at IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.rooms r
    WHERE r.id = room_id
  )
);

DROP POLICY IF EXISTS "Authenticated users can delete messages they can access" ON public.messages;
CREATE POLICY "Authenticated users can delete messages they can access" ON public.messages
FOR DELETE USING (
  auth.uid() = user_id
  OR (
    is_view_once = true
    AND EXISTS (
      SELECT 1
      FROM public.rooms r
      WHERE r.id = room_id
    )
  )
);

-- 8.1 Politicas do Storage
DROP POLICY IF EXISTS "Authenticated users can upload ephemeral media" ON storage.objects;
CREATE POLICY "Authenticated users can upload ephemeral media" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'ephemeral-media'
  AND EXISTS (
    SELECT 1
    FROM public.rooms r
    WHERE r.id::text = split_part(name, '/', 1)
  )
);

DROP POLICY IF EXISTS "Authenticated users can read ephemeral media" ON storage.objects;
CREATE POLICY "Authenticated users can read ephemeral media" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'ephemeral-media'
  AND EXISTS (
    SELECT 1
    FROM public.rooms r
    WHERE r.id::text = split_part(name, '/', 1)
  )
);

DROP POLICY IF EXISTS "Authenticated users can delete ephemeral media" ON storage.objects;
CREATE POLICY "Authenticated users can delete ephemeral media" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'ephemeral-media'
  AND EXISTS (
    SELECT 1
    FROM public.rooms r
    WHERE r.id::text = split_part(name, '/', 1)
  )
);

-- 9. Limpeza por expires_at
CREATE OR REPLACE FUNCTION public.delete_expired_messages()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.messages
  WHERE expires_at IS NOT NULL
    AND expires_at <= now();
END;
$$;

COMMENT ON FUNCTION public.delete_expired_messages() IS
'Remove mensagens expiradas usando expires_at. Execute por cron agendado, nao por trigger fixa.';

-- 10. Onboarding de usuario
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    username,
    avatar_url,
    profile_emoji,
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
    COALESCE(new.raw_user_meta_data->>'profile_emoji', '🙂'),
    COALESCE(new.raw_user_meta_data->>'age_group', 'Livre'),
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'cpf',
    (new.raw_user_meta_data->>'birth_date')::DATE,
    new.raw_user_meta_data->>'address'
  )
  ON CONFLICT (id) DO UPDATE SET
    profile_emoji = EXCLUDED.profile_emoji,
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
