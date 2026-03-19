-- Migração: modos de visualização de mídia e proteção adicional de chat
-- Data: 2026-03-18

ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS media_view_mode TEXT CHECK (media_view_mode IN ('once', '30s'));

ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS media_view_seconds INTEGER;

UPDATE public.messages
SET media_view_mode = 'once'
WHERE is_view_once = true
  AND media_view_mode IS NULL;

UPDATE public.messages
SET media_view_seconds = 30
WHERE media_view_mode = '30s'
  AND media_view_seconds IS NULL;
