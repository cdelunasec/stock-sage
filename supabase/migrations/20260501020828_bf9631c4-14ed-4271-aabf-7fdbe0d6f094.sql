-- 1) Función atómica para reservar el siguiente correlativo de factura por tenant
CREATE OR REPLACE FUNCTION public.next_factura_correlativo(_tenant_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next integer;
BEGIN
  -- Verificar acceso: el caller debe pertenecer al tenant o ser superadmin
  IF NOT (public.is_superadmin() OR _tenant_id = public.current_tenant_id()) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  UPDATE public.tenants
  SET siguiente_correlativo = siguiente_correlativo + 1,
      updated_at = now()
  WHERE id = _tenant_id
  RETURNING siguiente_correlativo - 1 INTO v_next;

  IF v_next IS NULL THEN
    RAISE EXCEPTION 'Tenant no encontrado';
  END IF;

  RETURN v_next;
END;
$$;

-- 2) Reparar siguiente_correlativo en base a facturas reales existentes
UPDATE public.tenants t
SET siguiente_correlativo = COALESCE(sub.max_corr, 0) + 1
FROM (
  SELECT tenant_id, MAX(correlativo) AS max_corr
  FROM public.facturas
  GROUP BY tenant_id
) sub
WHERE t.id = sub.tenant_id;

-- Para tenants sin facturas, garantizar siguiente_correlativo = 1
UPDATE public.tenants
SET siguiente_correlativo = 1
WHERE id NOT IN (SELECT DISTINCT tenant_id FROM public.facturas)
  AND siguiente_correlativo <> 1;