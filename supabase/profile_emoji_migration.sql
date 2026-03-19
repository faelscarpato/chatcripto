-- Migração: substituir avatar de perfil por emoji leve
-- Data: 2026-03-18

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS profile_emoji TEXT;

UPDATE public.profiles
SET profile_emoji = '🙂'
WHERE profile_emoji IS NULL OR profile_emoji = '';

ALTER TABLE public.profiles
ALTER COLUMN profile_emoji SET DEFAULT '🙂';

ALTER TABLE public.profiles
ALTER COLUMN profile_emoji SET NOT NULL;

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
