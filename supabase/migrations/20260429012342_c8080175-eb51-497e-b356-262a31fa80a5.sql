-- Enum frecuencia
DO $$ BEGIN
  CREATE TYPE public.gasto_frecuencia AS ENUM ('mensual', 'semanal', 'quincenal', 'anual');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Tabla gastos_recurrentes (plantillas)
CREATE TABLE IF NOT EXISTS public.gastos_recurrentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  concepto TEXT NOT NULL,
  categoria TEXT,
  monto NUMERIC(14,2) NOT NULL DEFAULT 0,
  frecuencia public.gasto_frecuencia NOT NULL DEFAULT 'mensual',
  dia_mes INTEGER,
  proximo_vencimiento DATE NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT true,
  proveedor_id UUID,
  notas TEXT,
  user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.gastos_recurrentes ENABLE ROW LEVEL SECURITY;

CREATE POLICY gr_select ON public.gastos_recurrentes FOR SELECT TO authenticated
USING (is_superadmin() OR (tenant_id = current_tenant_id() AND subscription_allows_access(tenant_id)));

CREATE POLICY gr_manage ON public.gastos_recurrentes FOR ALL TO authenticated
USING (is_superadmin() OR (tenant_id = current_tenant_id() AND can_manage() AND subscription_allows_writes(tenant_id)))
WITH CHECK (is_superadmin() OR (tenant_id = current_tenant_id() AND can_manage() AND subscription_allows_writes(tenant_id)));

CREATE TRIGGER gr_updated_at BEFORE UPDATE ON public.gastos_recurrentes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabla gastos
CREATE TABLE IF NOT EXISTS public.gastos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  concepto TEXT NOT NULL,
  categoria TEXT,
  monto NUMERIC(14,2) NOT NULL DEFAULT 0,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  metodo_pago TEXT,
  proveedor_id UUID,
  recurrente_id UUID REFERENCES public.gastos_recurrentes(id) ON DELETE SET NULL,
  notas TEXT,
  user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.gastos ENABLE ROW LEVEL SECURITY;

CREATE POLICY g_select ON public.gastos FOR SELECT TO authenticated
USING (is_superadmin() OR (tenant_id = current_tenant_id() AND subscription_allows_access(tenant_id)));

CREATE POLICY g_manage ON public.gastos FOR ALL TO authenticated
USING (is_superadmin() OR (tenant_id = current_tenant_id() AND can_manage() AND subscription_allows_writes(tenant_id)))
WITH CHECK (is_superadmin() OR (tenant_id = current_tenant_id() AND can_manage() AND subscription_allows_writes(tenant_id)));

CREATE TRIGGER g_updated_at BEFORE UPDATE ON public.gastos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_gastos_tenant_fecha ON public.gastos(tenant_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_gastos_recurrentes_tenant ON public.gastos_recurrentes(tenant_id, proximo_vencimiento);