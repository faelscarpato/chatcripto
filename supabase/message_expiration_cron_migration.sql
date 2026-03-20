-- Migration: limpeza programada por expires_at
-- Data: 2026-03-20

CREATE EXTENSION IF NOT EXISTS pg_cron;

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
'Limpeza de mensagens expiradas baseada em expires_at. Execute via pg_cron.';

DO $$
DECLARE
  existing_job_id BIGINT;
BEGIN
  SELECT jobid
  INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'chatcripto-delete-expired-messages'
  LIMIT 1;

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;

  PERFORM cron.schedule(
    'chatcripto-delete-expired-messages',
    '*/2 * * * *',
    'SELECT public.delete_expired_messages();'
  );
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'pg_cron nao esta disponivel neste ambiente. Agende public.delete_expired_messages() externamente.';
END;
$$;
