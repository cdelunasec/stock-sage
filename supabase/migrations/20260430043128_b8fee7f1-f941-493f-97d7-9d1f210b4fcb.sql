-- Sugerencias y notas al administrador
CREATE TYPE sugerencia_tipo AS ENUM ('sugerencia', 'nota', 'reporte_bug', 'pregunta');
CREATE TYPE sugerencia_estado AS ENUM ('abierta', 'en_revision', 'respondida', 'cerrada');

CREATE TABLE public.sugerencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  asunto TEXT NOT NULL,
  mensaje TEXT NOT NULL,
  tipo sugerencia_tipo NOT NULL DEFAULT 'sugerencia',
  estado sugerencia_estado NOT NULL DEFAULT 'abierta',
  respuesta TEXT,
  respondida_por UUID,
  respondida_en TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sugerencias_tenant ON public.sugerencias(tenant_id, created_at DESC);
CREATE INDEX idx_sugerencias_user ON public.sugerencias(user_id, created_at DESC);

ALTER TABLE public.sugerencias ENABLE ROW LEVEL SECURITY;

-- SELECT: el autor ve las suyas, admin ve todas las del tenant, superadmin ve todo
CREATE POLICY sug_select ON public.sugerencias
FOR SELECT TO authenticated
USING (
  is_superadmin()
  OR (tenant_id = current_tenant_id() AND (user_id = auth.uid() OR is_admin()))
);

-- INSERT: cualquier usuario autenticado del tenant puede crear, asignándose como autor
CREATE POLICY sug_insert ON public.sugerencias
FOR INSERT TO authenticated
WITH CHECK (
  tenant_id = current_tenant_id() AND user_id = auth.uid()
);

-- UPDATE: solo admin del tenant (o superadmin) puede responder/cerrar
CREATE POLICY sug_update_admin ON public.sugerencias
FOR UPDATE TO authenticated
USING (
  is_superadmin() OR (tenant_id = current_tenant_id() AND is_admin())
)
WITH CHECK (
  is_superadmin() OR (tenant_id = current_tenant_id() AND is_admin())
);

-- DELETE: solo admin
CREATE POLICY sug_delete_admin ON public.sugerencias
FOR DELETE TO authenticated
USING (
  is_superadmin() OR (tenant_id = current_tenant_id() AND is_admin())
);

CREATE TRIGGER trg_sugerencias_updated
BEFORE UPDATE ON public.sugerencias
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();