ALTER TABLE public.rooms
ADD COLUMN IF NOT EXISTS password_verifier TEXT;

DROP POLICY IF EXISTS "Authenticated users can create rooms" ON public.rooms;
CREATE POLICY "Authenticated users can create rooms" ON public.rooms
FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated' AND
  age_group = (SELECT COALESCE(age_group, 'Livre') FROM public.profiles WHERE id = auth.uid()) AND
  password_verifier IS NOT NULL
);

COMMENT ON COLUMN public.rooms.password_verifier IS
'Verificador deterministico da senha da sala. Permite validar a chave sem armazenar a senha em texto puro.';
