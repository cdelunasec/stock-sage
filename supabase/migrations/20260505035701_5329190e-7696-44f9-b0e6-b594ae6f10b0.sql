
-- ============ NCF ============
CREATE TYPE public.ncf_tipo AS ENUM ('B01','B02','B14','B15');

CREATE TABLE public.ncf_secuencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  tipo public.ncf_tipo NOT NULL,
  prefijo text NOT NULL,
  secuencia_desde bigint NOT NULL,
  secuencia_hasta bigint NOT NULL,
  secuencia_actual bigint NOT NULL,
  fecha_vencimiento date,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, tipo, secuencia_desde)
);

ALTER TABLE public.ncf_secuencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY ncf_select ON public.ncf_secuencias FOR SELECT TO authenticated
USING (is_superadmin() OR (tenant_id = current_tenant_id() AND subscription_allows_access(tenant_id)));

CREATE POLICY ncf_manage ON public.ncf_secuencias FOR ALL TO authenticated
USING (is_superadmin() OR (tenant_id = current_tenant_id() AND is_admin() AND subscription_allows_writes(tenant_id)))
WITH CHECK (is_superadmin() OR (tenant_id = current_tenant_id() AND is_admin() AND subscription_allows_writes(tenant_id)));

CREATE TRIGGER trg_ncf_updated BEFORE UPDATE ON public.ncf_secuencias
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS ncf text;
ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS ncf_tipo public.ncf_tipo;

ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS ncf_tipo_default public.ncf_tipo;

CREATE OR REPLACE FUNCTION public.next_ncf(_tenant_id uuid, _tipo public.ncf_tipo)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row record;
  v_ncf text;
BEGIN
  IF NOT (is_superadmin() OR _tenant_id = current_tenant_id()) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT * INTO v_row FROM public.ncf_secuencias
   WHERE tenant_id = _tenant_id AND tipo = _tipo AND activo = true
     AND secuencia_actual <= secuencia_hasta
     AND (fecha_vencimiento IS NULL OR fecha_vencimiento >= CURRENT_DATE)
   ORDER BY secuencia_desde
   FOR UPDATE
   LIMIT 1;

  IF v_row IS NULL THEN
    RAISE EXCEPTION 'No hay secuencia NCF disponible para tipo %', _tipo;
  END IF;

  v_ncf := v_row.prefijo || lpad(v_row.secuencia_actual::text, 8, '0');

  UPDATE public.ncf_secuencias
     SET secuencia_actual = secuencia_actual + 1,
         updated_at = now()
   WHERE id = v_row.id;

  RETURN v_ncf;
END;
$$;

-- ============ Cuentas por Pagar ============
CREATE TYPE public.oc_estado AS ENUM ('borrador','recibida','pagada_parcial','pagada','anulada');

CREATE TABLE public.ordenes_compra (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  proveedor_id uuid NOT NULL,
  almacen_id uuid,
  numero serial,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  fecha_vencimiento date,
  condicion_pago text NOT NULL DEFAULT 'contado',
  subtotal numeric NOT NULL DEFAULT 0,
  impuesto numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  saldo numeric NOT NULL DEFAULT 0,
  estado public.oc_estado NOT NULL DEFAULT 'borrador',
  notas text,
  ncf text,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ordenes_compra ENABLE ROW LEVEL SECURITY;

CREATE POLICY oc_select ON public.ordenes_compra FOR SELECT TO authenticated
USING (is_superadmin() OR (tenant_id = current_tenant_id() AND subscription_allows_access(tenant_id)));
CREATE POLICY oc_manage ON public.ordenes_compra FOR ALL TO authenticated
USING (is_superadmin() OR (tenant_id = current_tenant_id() AND can_manage() AND subscription_allows_writes(tenant_id)))
WITH CHECK (is_superadmin() OR (tenant_id = current_tenant_id() AND can_manage() AND subscription_allows_writes(tenant_id)));

CREATE TRIGGER trg_oc_updated BEFORE UPDATE ON public.ordenes_compra
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.orden_compra_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_id uuid NOT NULL REFERENCES public.ordenes_compra(id) ON DELETE CASCADE,
  producto_id uuid,
  descripcion text NOT NULL,
  cantidad numeric NOT NULL,
  precio_unitario numeric NOT NULL,
  impuesto_pct numeric NOT NULL DEFAULT 0,
  subtotal numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.orden_compra_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY oci_select ON public.orden_compra_items FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.ordenes_compra o WHERE o.id = orden_id
  AND (is_superadmin() OR (o.tenant_id = current_tenant_id() AND subscription_allows_access(o.tenant_id)))));
CREATE POLICY oci_manage ON public.orden_compra_items FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.ordenes_compra o WHERE o.id = orden_id
  AND (is_superadmin() OR (o.tenant_id = current_tenant_id() AND can_manage() AND subscription_allows_writes(o.tenant_id)))))
WITH CHECK (EXISTS (SELECT 1 FROM public.ordenes_compra o WHERE o.id = orden_id
  AND (is_superadmin() OR (o.tenant_id = current_tenant_id() AND can_manage() AND subscription_allows_writes(o.tenant_id)))));

CREATE TABLE public.pagos_proveedor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  orden_id uuid NOT NULL REFERENCES public.ordenes_compra(id) ON DELETE CASCADE,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  monto numeric NOT NULL,
  metodo_pago text,
  notas text,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pagos_proveedor ENABLE ROW LEVEL SECURITY;

CREATE POLICY pp_select ON public.pagos_proveedor FOR SELECT TO authenticated
USING (is_superadmin() OR (tenant_id = current_tenant_id() AND subscription_allows_access(tenant_id)));
CREATE POLICY pp_manage ON public.pagos_proveedor FOR ALL TO authenticated
USING (is_superadmin() OR (tenant_id = current_tenant_id() AND can_manage() AND subscription_allows_writes(tenant_id)))
WITH CHECK (is_superadmin() OR (tenant_id = current_tenant_id() AND can_manage() AND subscription_allows_writes(tenant_id)));

CREATE OR REPLACE FUNCTION public.registrar_pago_proveedor(
  _orden_id uuid, _monto numeric, _metodo text, _fecha date, _notas text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tenant uuid; v_total numeric; v_saldo numeric; v_pagado numeric; v_id uuid;
BEGIN
  SELECT tenant_id, total, saldo INTO v_tenant, v_total, v_saldo
  FROM public.ordenes_compra WHERE id = _orden_id;
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'OC no encontrada'; END IF;
  IF NOT (is_superadmin() OR (v_tenant = current_tenant_id() AND can_manage())) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  IF _monto <= 0 OR _monto > v_saldo THEN RAISE EXCEPTION 'Monto inválido'; END IF;

  INSERT INTO public.pagos_proveedor (tenant_id, orden_id, fecha, monto, metodo_pago, notas, user_id)
  VALUES (v_tenant, _orden_id, COALESCE(_fecha, CURRENT_DATE), _monto, _metodo, _notas, auth.uid())
  RETURNING id INTO v_id;

  v_pagado := v_total - (v_saldo - _monto);
  UPDATE public.ordenes_compra
    SET saldo = saldo - _monto,
        estado = CASE WHEN saldo - _monto <= 0 THEN 'pagada'::oc_estado
                      WHEN v_pagado > 0 THEN 'pagada_parcial'::oc_estado
                      ELSE estado END,
        updated_at = now()
    WHERE id = _orden_id;
  RETURN v_id;
END; $$;
