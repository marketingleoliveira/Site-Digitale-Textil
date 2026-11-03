REVOKE ALL ON FUNCTION public.queue_qualified_crm_lead() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.queue_qualified_crm_lead() FROM anon;
REVOKE ALL ON FUNCTION public.queue_qualified_crm_lead() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.queue_qualified_crm_lead() TO service_role;