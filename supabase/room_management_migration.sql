ALTER TABLE public.rooms
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

DROP POLICY IF EXISTS "Authenticated users can create rooms" ON public.rooms;
CREATE POLICY "Authenticated users can create rooms" ON public.rooms
FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated' AND
  created_by = auth.uid() AND
  age_group = (SELECT COALESCE(age_group, 'Livre') FROM public.profiles WHERE id = auth.uid()) AND
  password_verifier IS NOT NULL
);

DROP POLICY IF EXISTS "Room creators can update their own rooms" ON public.rooms;
CREATE POLICY "Room creators can update their own rooms" ON public.rooms
FOR UPDATE
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Room creators can delete their own rooms" ON public.rooms;
CREATE POLICY "Room creators can delete their own rooms" ON public.rooms
FOR DELETE
USING (created_by = auth.uid());

COMMENT ON COLUMN public.rooms.created_by IS
'Usuario que criou a sala e possui permissao para editar, privar, abrir ou apagar.';
