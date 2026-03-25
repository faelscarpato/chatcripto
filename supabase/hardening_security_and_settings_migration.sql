-- Migration: hardening RLS + secure room join + base tables for settings/age verification
-- Date: 2026-03-25

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Helpers -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.try_parse_uuid(input text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN input::uuid;
EXCEPTION
  WHEN invalid_text_representation THEN
    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_profile_age_group(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT age_group FROM public.profiles WHERE id = p_user_id), 'Livre');
$$;

CREATE OR REPLACE FUNCTION public.is_room_member(p_room_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_room_id IS NULL OR p_user_id IS NULL THEN false
    ELSE EXISTS (
      SELECT 1
      FROM public.rooms r
      WHERE r.id = p_room_id
        AND (
          r.created_by = p_user_id
          OR EXISTS (
            SELECT 1
            FROM public.room_access ra
            WHERE ra.room_id = r.id
              AND ra.user_id = p_user_id
          )
        )
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.hash_room_password(p_room_id uuid, p_password text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT encode(digest(format('room:%s:%s', p_room_id::text, p_password), 'sha256'), 'base64');
$$;

-- Secure join flow -----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_room_invite_snapshot(p_room_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  category text,
  visibility text,
  message_ttl_minutes integer,
  require_password_every_time boolean,
  password_verifier text,
  age_group text,
  created_by uuid,
  last_activity_at timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  current_age_group text;
BEGIN
  IF current_user_id IS NULL THEN
    RETURN;
  END IF;

  current_age_group := public.get_profile_age_group(current_user_id);

  RETURN QUERY
  SELECT
    r.id,
    r.name,
    r.description,
    r.category,
    r.visibility,
    r.message_ttl_minutes,
    r.require_password_every_time,
    r.password_verifier,
    r.age_group,
    r.created_by,
    r.last_activity_at,
    r.created_at
  FROM public.rooms r
  WHERE r.id = p_room_id
    AND r.age_group = current_age_group
    AND (
      r.created_by = current_user_id
      OR r.visibility = 'public'
      OR r.visibility = 'unlisted'
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.join_room_with_password(p_room_id uuid, p_password text)
RETURNS TABLE (ok boolean, reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  current_age_group text;
  room_row public.rooms%ROWTYPE;
  computed_verifier text;
BEGIN
  IF current_user_id IS NULL THEN
    RETURN QUERY SELECT false, 'unauthenticated';
    RETURN;
  END IF;

  SELECT * INTO room_row
  FROM public.rooms
  WHERE id = p_room_id;

  IF room_row.id IS NULL THEN
    RETURN QUERY SELECT false, 'room_not_found';
    RETURN;
  END IF;

  current_age_group := public.get_profile_age_group(current_user_id);

  IF room_row.age_group <> current_age_group THEN
    RETURN QUERY SELECT false, 'age_group_mismatch';
    RETURN;
  END IF;

  IF room_row.visibility = 'personal' AND room_row.created_by <> current_user_id THEN
    RETURN QUERY SELECT false, 'personal_room_forbidden';
    RETURN;
  END IF;

  IF room_row.password_verifier IS NULL THEN
    RETURN QUERY SELECT false, 'room_without_verifier';
    RETURN;
  END IF;

  computed_verifier := public.hash_room_password(room_row.id, p_password);

  IF computed_verifier <> room_row.password_verifier THEN
    RETURN QUERY SELECT false, 'invalid_password';
    RETURN;
  END IF;

  INSERT INTO public.room_access (user_id, room_id, role, last_seen_at)
  VALUES (
    current_user_id,
    room_row.id,
    CASE WHEN room_row.created_by = current_user_id THEN 'owner' ELSE 'member' END,
    now()
  )
  ON CONFLICT (user_id, room_id)
  DO UPDATE SET
    role = EXCLUDED.role,
    last_seen_at = EXCLUDED.last_seen_at;

  RETURN QUERY SELECT true, 'ok';
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_room_invite_snapshot(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_room_with_password(uuid, text) TO authenticated;

-- RLS Hardening: rooms -------------------------------------------------------
DROP POLICY IF EXISTS "Rooms are viewable by users in the same age group" ON public.rooms;
CREATE POLICY "Rooms are viewable by age and membership" ON public.rooms
FOR SELECT USING (
  age_group = public.get_profile_age_group(auth.uid())
  AND (
    created_by = auth.uid()
    OR visibility = 'public'
    OR public.is_room_member(id, auth.uid())
  )
);

-- RLS Hardening: room_access -------------------------------------------------
DROP POLICY IF EXISTS "Users can insert their own access" ON public.room_access;
CREATE POLICY "Users can insert own access only for owned rooms" ON public.room_access
FOR INSERT WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.rooms r
    WHERE r.id = room_id
      AND r.created_by = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can delete their own access" ON public.room_access;
CREATE POLICY "Users can delete their own access" ON public.room_access
FOR DELETE USING (auth.uid() = user_id);

-- RLS Hardening: messages ----------------------------------------------------
DROP POLICY IF EXISTS "Messages are viewable by authenticated users" ON public.messages;
CREATE POLICY "Messages are viewable by room members" ON public.messages
FOR SELECT USING (public.is_room_member(room_id, auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can insert messages" ON public.messages;
CREATE POLICY "Authenticated users can insert messages" ON public.messages
FOR INSERT WITH CHECK (
  auth.uid() = user_id
  AND expires_at IS NOT NULL
  AND public.is_room_member(room_id, auth.uid())
);

DROP POLICY IF EXISTS "Authenticated users can delete messages they can access" ON public.messages;
CREATE POLICY "Authenticated users can delete messages they can access" ON public.messages
FOR DELETE USING (
  public.is_room_member(room_id, auth.uid())
  AND (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1
      FROM public.rooms r
      WHERE r.id = room_id
        AND r.created_by = auth.uid()
    )
    OR is_view_once = true
  )
);

-- RLS Hardening: ephemeral-media storage ------------------------------------
DROP POLICY IF EXISTS "Authenticated users can upload ephemeral media" ON storage.objects;
CREATE POLICY "Authenticated users can upload ephemeral media" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'ephemeral-media'
  AND public.is_room_member(public.try_parse_uuid(split_part(name, '/', 1)), auth.uid())
);

DROP POLICY IF EXISTS "Authenticated users can read ephemeral media" ON storage.objects;
CREATE POLICY "Authenticated users can read ephemeral media" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'ephemeral-media'
  AND public.is_room_member(public.try_parse_uuid(split_part(name, '/', 1)), auth.uid())
);

DROP POLICY IF EXISTS "Authenticated users can delete ephemeral media" ON storage.objects;
CREATE POLICY "Authenticated users can delete ephemeral media" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'ephemeral-media'
  AND public.is_room_member(public.try_parse_uuid(split_part(name, '/', 1)), auth.uid())
);

-- New table: user settings (for Security/Chat Settings screens) -------------
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  notifications_enabled boolean NOT NULL DEFAULT true,
  privacy_blur_media boolean NOT NULL DEFAULT true,
  enforce_view_once boolean NOT NULL DEFAULT false,
  biometric_lock_enabled boolean NOT NULL DEFAULT false,
  panic_wipe_enabled boolean NOT NULL DEFAULT false,
  global_message_ttl_minutes integer CHECK (global_message_ttl_minutes IN (5, 10, 15, 20)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own settings" ON public.user_settings;
CREATE POLICY "Users can view own settings" ON public.user_settings
FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own settings" ON public.user_settings;
CREATE POLICY "Users can insert own settings" ON public.user_settings
FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own settings" ON public.user_settings;
CREATE POLICY "Users can update own settings" ON public.user_settings
FOR UPDATE USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- New table: age verification requests --------------------------------------
CREATE TABLE IF NOT EXISTS public.age_verification_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected', 'needs_review', 'expired')),
  requested_age_group text NOT NULL CHECK (requested_age_group IN ('Livre', '+18')),
  provider text,
  provider_reference text,
  document_country text,
  liveness_score numeric(5,2),
  rejection_reason text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS age_verification_one_active_per_user_idx
ON public.age_verification_requests (user_id)
WHERE status IN ('pending', 'needs_review');

CREATE INDEX IF NOT EXISTS age_verification_user_status_idx
ON public.age_verification_requests (user_id, status, created_at DESC);

ALTER TABLE public.age_verification_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own age verification requests" ON public.age_verification_requests;
CREATE POLICY "Users can view own age verification requests" ON public.age_verification_requests
FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own age verification requests" ON public.age_verification_requests;
CREATE POLICY "Users can create own age verification requests" ON public.age_verification_requests
FOR INSERT WITH CHECK (
  auth.uid() = user_id
  AND status = 'pending'
);

-- updated_at trigger ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_settings_set_updated_at ON public.user_settings;
CREATE TRIGGER user_settings_set_updated_at
BEFORE UPDATE ON public.user_settings
FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

DROP TRIGGER IF EXISTS age_verification_requests_set_updated_at ON public.age_verification_requests;
CREATE TRIGGER age_verification_requests_set_updated_at
BEFORE UPDATE ON public.age_verification_requests
FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

COMMENT ON FUNCTION public.join_room_with_password(uuid, text) IS
'Join seguro de sala com validacao do password_verifier no banco e upsert de room_access.';

COMMENT ON FUNCTION public.get_room_invite_snapshot(uuid) IS
'Retorna metadados minimos para fluxo de convite sem liberar listagem ampla de salas unlisted.';
