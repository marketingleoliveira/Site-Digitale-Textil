CREATE TABLE public.crm_lead_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fabric_lead_id uuid NOT NULL UNIQUE REFERENCES public.fabric_leads(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivering', 'delivered', 'failed')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_attempt_at timestamptz,
  delivered_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.crm_lead_deliveries TO authenticated;
GRANT ALL ON public.crm_lead_deliveries TO service_role;
ALTER TABLE public.crm_lead_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Developers can view CRM deliveries"
ON public.crm_lead_deliveries FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'desenvolvedor'::public.app_role));
CREATE POLICY "Service role manages CRM deliveries"
ON public.crm_lead_deliveries FOR ALL TO service_role
USING (true) WITH CHECK (true);
CREATE TRIGGER crm_lead_deliveries_updated_at
BEFORE UPDATE ON public.crm_lead_deliveries
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE FUNCTION public.queue_qualified_crm_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'qualified' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO public.crm_lead_deliveries (fabric_lead_id, status)
    VALUES (NEW.fabric_lead_id, 'pending')
    ON CONFLICT (fabric_lead_id) DO UPDATE
      SET status = CASE WHEN public.crm_lead_deliveries.status = 'delivered' THEN 'delivered' ELSE 'pending' END,
          last_error = CASE WHEN public.crm_lead_deliveries.status = 'delivered' THEN public.crm_lead_deliveries.last_error ELSE NULL END,
          updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS queue_qualified_crm_lead_trigger ON public.lead_validations;
CREATE TRIGGER queue_qualified_crm_lead_trigger
AFTER INSERT OR UPDATE OF status ON public.lead_validations
FOR EACH ROW EXECUTE FUNCTION public.queue_qualified_crm_lead();

INSERT INTO public.crm_lead_deliveries (fabric_lead_id, status)
SELECT lv.fabric_lead_id, 'pending'
FROM public.lead_validations lv
WHERE lv.status = 'qualified'
ON CONFLICT (fabric_lead_id) DO NOTHING;