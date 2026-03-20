-- Migration: visibilidade, TTL por sala e metadados de ownership
-- Data: 2026-03-20

ALTER TABLE public.rooms
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'unlisted', 'personal')),
ADD COLUMN IF NOT EXISTS message_ttl_minutes INTEGER DEFAULT 20 CHECK (message_ttl_minutes IN (5, 10, 15, 20)),
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ DEFAULT now();

UPDATE public.rooms
SET visibility = 'public'
WHERE visibility IS NULL;

UPDATE public.rooms
SET message_ttl_minutes = 20
WHERE message_ttl_minutes IS NULL;

UPDATE public.rooms
SET is_archived = false
WHERE is_archived IS NULL;

UPDATE public.rooms
SET last_activity_at = COALESCE(last_activity_at, created_at, now())
WHERE last_activity_at IS NULL;

ALTER TABLE public.room_access
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'member')),
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

ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'user' CHECK (message_type IN ('user', 'system')),
ADD COLUMN IF NOT EXISTS metadata JSONB;

UPDATE public.messages
SET expires_at = created_at + make_interval(mins => 20)
WHERE expires_at IS NULL
  AND is_view_once = false;

UPDATE public.messages
SET expires_at = created_at + interval '24 hours'
WHERE expires_at IS NULL
  AND is_view_once = true;

CREATE INDEX IF NOT EXISTS rooms_created_by_idx ON public.rooms(created_by);
CREATE INDEX IF NOT EXISTS rooms_visibility_created_at_idx ON public.rooms(visibility, created_at DESC);
CREATE INDEX IF NOT EXISTS rooms_last_activity_idx ON public.rooms(last_activity_at DESC);
CREATE INDEX IF NOT EXISTS room_access_user_last_seen_idx ON public.room_access(user_id, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS messages_room_expires_idx ON public.messages(room_id, expires_at);
