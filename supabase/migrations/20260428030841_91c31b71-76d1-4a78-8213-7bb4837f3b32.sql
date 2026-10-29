-- Estado de cotización
DO $$ BEGIN
  CREATE TYPE public.cotizacion_estado AS ENUM ('borrador','enviada','aceptada','rechazada','convertida','vencida');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Secuencia para número correlativo
CREATE SEQUENCE IF NOT EXISTS public.cotizaciones_numero_seq;

-- Tabla cotizaciones
CREATE TABLE IF NOT EXISTS public.cotizaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  numero integer NOT NULL DEFAULT nextval('public.cotizaciones_numero_seq'),
  cliente_id uuid,
  almacen_id uuid NOT NULL,
  user_id uuid,
  fecha timestamptz NOT NULL DEFAULT now(),
  valida_hasta timestamptz,
  subtotal numeric NOT NULL DEFAULT 0,
  impuesto numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  estado public.cotizacion_estado NOT NULL DEFAULT 'borrador',
  notas text,
  venta_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cotizaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cot_select" ON public.cotizaciones
  FOR SELECT TO authenticated
  USING (is_superadmin() OR (tenant_id = current_tenant_id() AND subscription_allows_access(tenant_id)));

CREATE POLICY "cot_insert" ON public.cotizaciones
  FOR INSERT TO authenticated
  WITH CHECK (is_superadmin() OR (tenant_id = current_tenant_id() AND subscription_allows_writes(tenant_id)));

CREATE POLICY "cot_update" ON public.cotizaciones
  FOR UPDATE TO authenticated
  USING (is_superadmin() OR (tenant_id = current_tenant_id() AND can_manage() AND subscription_allows_writes(tenant_id)));

CREATE POLICY "cot_delete" ON public.cotizaciones
  FOR DELETE TO authenticated
  USING (is_superadmin() OR (tenant_id = current_tenant_id() AND can_manage() AND subscription_allows_writes(tenant_id)));

CREATE TRIGGER trg_cotizaciones_updated
  BEFORE UPDATE ON public.cotizaciones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabla cotizacion_items
CREATE TABLE IF NOT EXISTS public.cotizacion_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cotizacion_id uuid NOT NULL REFERENCES public.cotizaciones(id) ON DELETE CASCADE,
  producto_id uuid,
  servicio_id uuid,
  descripcion text,
  cantidad numeric NOT NULL,
  precio_unitario numeric NOT NULL,
  impuesto_pct numeric NOT NULL DEFAULT 0,
  subtotal numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cotizacion_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ci_select" ON public.cotizacion_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.cotizaciones c
    WHERE c.id = cotizacion_items.cotizacion_id
      AND (is_superadmin() OR (c.tenant_id = current_tenant_id() AND subscription_allows_access(c.tenant_id)))
  ));

CREATE POLICY "ci_insert" ON public.cotizacion_items
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.cotizaciones c
    WHERE c.id = cotizacion_items.cotizacion_id
      AND (is_superadmin() OR (c.tenant_id = current_tenant_id() AND subscription_allows_writes(c.tenant_id)))
  ));

CREATE POLICY "ci_delete" ON public.cotizacion_items
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.cotizaciones c
    WHERE c.id = cotizacion_items.cotizacion_id
      AND (is_superadmin() OR (c.tenant_id = current_tenant_id() AND can_manage() AND subscription_allows_writes(c.tenant_id)))
  ));

CREATE INDEX IF NOT EXISTS idx_cotizaciones_tenant ON public.cotizaciones(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cotizacion_items_cot ON public.cotizacion_items(cotizacion_id);