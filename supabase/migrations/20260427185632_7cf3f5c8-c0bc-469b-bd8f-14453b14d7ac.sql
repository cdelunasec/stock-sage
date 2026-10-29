
-- 1) Tabla servicios
CREATE TABLE public.servicios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  precio NUMERIC(14,2) NOT NULL DEFAULT 0,
  impuesto_pct NUMERIC(6,2) NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_servicios_tenant ON public.servicios(tenant_id);

ALTER TABLE public.servicios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "serv_select" ON public.servicios FOR SELECT TO authenticated
  USING (is_superadmin() OR (tenant_id = current_tenant_id() AND subscription_allows_access(tenant_id)));

CREATE POLICY "serv_manage" ON public.servicios FOR ALL TO authenticated
  USING (is_superadmin() OR (tenant_id = current_tenant_id() AND can_manage() AND subscription_allows_writes(tenant_id)))
  WITH CHECK (is_superadmin() OR (tenant_id = current_tenant_id() AND can_manage() AND subscription_allows_writes(tenant_id)));

CREATE TRIGGER servicios_updated_at BEFORE UPDATE ON public.servicios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) venta_items: soporte para servicios
ALTER TABLE public.venta_items ADD COLUMN servicio_id UUID;
ALTER TABLE public.venta_items ADD COLUMN descripcion TEXT;
ALTER TABLE public.venta_items ALTER COLUMN producto_id DROP NOT NULL;

ALTER TABLE public.venta_items ADD CONSTRAINT venta_items_producto_xor_servicio
  CHECK (
    (producto_id IS NOT NULL AND servicio_id IS NULL) OR
    (producto_id IS NULL AND servicio_id IS NOT NULL)
  );
