
ALTER TABLE public.facturas
  ADD COLUMN IF NOT EXISTS eliminada_en timestamptz,
  ADD COLUMN IF NOT EXISTS eliminada_por uuid,
  ADD COLUMN IF NOT EXISTS motivo_eliminacion text;

ALTER TABLE public.venta_items
  ADD COLUMN IF NOT EXISTS precio_original numeric,
  ADD COLUMN IF NOT EXISTS descuento_pct numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS descuento_motivo text;

ALTER TABLE public.factura_items
  ADD COLUMN IF NOT EXISTS precio_original numeric,
  ADD COLUMN IF NOT EXISTS descuento_motivo text;

-- Permitir DELETE soft via RPC (solo admin)
CREATE OR REPLACE FUNCTION public.eliminar_factura(_factura_id uuid, _motivo text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
BEGIN
  SELECT tenant_id INTO v_tenant FROM public.facturas WHERE id = _factura_id;
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'Factura no encontrada'; END IF;
  IF NOT (is_superadmin() OR (v_tenant = current_tenant_id() AND is_admin())) THEN
    RAISE EXCEPTION 'Solo administradores pueden eliminar facturas';
  END IF;
  IF _motivo IS NULL OR length(trim(_motivo)) = 0 THEN
    RAISE EXCEPTION 'Debe indicar el motivo de eliminación';
  END IF;
  UPDATE public.facturas
     SET estado = 'eliminada',
         motivo_eliminacion = _motivo,
         eliminada_en = now(),
         eliminada_por = auth.uid(),
         updated_at = now()
   WHERE id = _factura_id;
END; $$;
