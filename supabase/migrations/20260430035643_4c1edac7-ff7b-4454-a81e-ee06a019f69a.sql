CREATE TABLE public.empleados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID,
  nombre_completo TEXT NOT NULL,
  documento TEXT,
  email TEXT,
  telefono TEXT,
  direccion TEXT,
  puesto TEXT,
  departamento TEXT,
  fecha_ingreso DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_salida DATE,
  salario_base NUMERIC(14,2) NOT NULL DEFAULT 0,
  tipo_contrato TEXT NOT NULL DEFAULT 'indefinido',
  activo BOOLEAN NOT NULL DEFAULT true,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_empleados_tenant ON public.empleados(tenant_id);
CREATE TRIGGER trg_empleados_updated_at BEFORE UPDATE ON public.empleados
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
ALTER TABLE public.empleados ENABLE ROW LEVEL SECURITY;
CREATE POLICY emp_select ON public.empleados FOR SELECT TO authenticated
USING (is_superadmin() OR ((tenant_id = current_tenant_id()) AND is_admin() AND subscription_allows_access(tenant_id)));
CREATE POLICY emp_manage ON public.empleados FOR ALL TO authenticated
USING (is_superadmin() OR ((tenant_id = current_tenant_id()) AND is_admin() AND subscription_allows_writes(tenant_id)))
WITH CHECK (is_superadmin() OR ((tenant_id = current_tenant_id()) AND is_admin() AND subscription_allows_writes(tenant_id)));

CREATE TABLE public.asistencia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  empleado_id UUID NOT NULL,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  hora_entrada TIME,
  hora_salida TIME,
  estado TEXT NOT NULL DEFAULT 'presente',
  horas_trabajadas NUMERIC(5,2),
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_asistencia_tenant ON public.asistencia(tenant_id);
CREATE INDEX idx_asistencia_empleado ON public.asistencia(empleado_id, fecha);
ALTER TABLE public.asistencia ENABLE ROW LEVEL SECURITY;
CREATE POLICY asis_select ON public.asistencia FOR SELECT TO authenticated
USING (is_superadmin() OR ((tenant_id = current_tenant_id()) AND is_admin() AND subscription_allows_access(tenant_id)));
CREATE POLICY asis_manage ON public.asistencia FOR ALL TO authenticated
USING (is_superadmin() OR ((tenant_id = current_tenant_id()) AND is_admin() AND subscription_allows_writes(tenant_id)))
WITH CHECK (is_superadmin() OR ((tenant_id = current_tenant_id()) AND is_admin() AND subscription_allows_writes(tenant_id)));

CREATE TABLE public.pagos_nomina (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  empleado_id UUID NOT NULL,
  periodo_inicio DATE NOT NULL,
  periodo_fin DATE NOT NULL,
  salario_base NUMERIC(14,2) NOT NULL DEFAULT 0,
  bonificaciones NUMERIC(14,2) NOT NULL DEFAULT 0,
  deducciones NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  fecha_pago DATE NOT NULL DEFAULT CURRENT_DATE,
  metodo_pago TEXT,
  estado TEXT NOT NULL DEFAULT 'pagado',
  notas TEXT,
  gasto_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pagos_tenant ON public.pagos_nomina(tenant_id);
CREATE INDEX idx_pagos_empleado ON public.pagos_nomina(empleado_id);
ALTER TABLE public.pagos_nomina ENABLE ROW LEVEL SECURITY;
CREATE POLICY pn_select ON public.pagos_nomina FOR SELECT TO authenticated
USING (is_superadmin() OR ((tenant_id = current_tenant_id()) AND is_admin() AND subscription_allows_access(tenant_id)));
CREATE POLICY pn_manage ON public.pagos_nomina FOR ALL TO authenticated
USING (is_superadmin() OR ((tenant_id = current_tenant_id()) AND is_admin() AND subscription_allows_writes(tenant_id)))
WITH CHECK (is_superadmin() OR ((tenant_id = current_tenant_id()) AND is_admin() AND subscription_allows_writes(tenant_id)));