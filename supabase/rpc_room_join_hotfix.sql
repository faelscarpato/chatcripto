-- Hotfix: expose room join RPCs and force PostgREST schema reload
-- Use this if /rpc/join_room_with_password returns 404

CREATE EXTENSION IF NOT EXISTS pgcrypto;

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

NOTIFY pgrst, 'reload schema';

-- Verification queries (optional)
-- SELECT proname, proargnames FROM pg_proc WHERE proname IN ('get_room_invite_snapshot', 'join_room_with_password');
-- SELECT n.nspname, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE p.proname = 'join_room_with_password';
