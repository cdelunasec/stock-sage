
-- ============ AUDIT LOG ============
CREATE INDEX IF NOT EXISTS idx_audit_user ON public.audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entidad ON public.audit_log(entidad, created_at DESC);

GRANT ALL ON public.audit_log TO service_role;

DROP POLICY IF EXISTS "audit_select_superadmin" ON public.audit_log;
CREATE POLICY "audit_select_superadmin" ON public.audit_log
  FOR SELECT TO authenticated
  USING (public.is_superadmin());

-- Función para registrar acciones
CREATE OR REPLACE FUNCTION public.log_audit(
  _accion text,
  _entidad text,
  _entidad_id uuid,
  _datos jsonb DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
  v_id uuid;
BEGIN
  v_tenant := public.current_tenant_id();
  IF v_tenant IS NULL THEN
    RETURN NULL;
  END IF;
  INSERT INTO public.audit_log (tenant_id, user_id, accion, entidad, entidad_id, datos)
  VALUES (v_tenant, auth.uid(), _accion, _entidad, _entidad_id, _datos)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- ============ VENTAS: atendido_por ============
ALTER TABLE public.ventas
  ADD COLUMN IF NOT EXISTS atendido_por_nombre text,
  ADD COLUMN IF NOT EXISTS created_by_email text;

CREATE OR REPLACE FUNCTION public.ventas_set_atendido()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_nombre text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT email, nombre_completo INTO v_email, v_nombre
      FROM public.profiles WHERE id = auth.uid();
    NEW.user_id := COALESCE(NEW.user_id, auth.uid());
    NEW.created_by_email := v_email;
    IF NEW.atendido_por_nombre IS NULL OR length(trim(NEW.atendido_por_nombre)) = 0 THEN
      NEW.atendido_por_nombre := COALESCE(v_nombre, v_email);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Proteger campos inmutables
    NEW.user_id := OLD.user_id;
    NEW.created_by_email := OLD.created_by_email;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ventas_atendido_ins ON public.ventas;
CREATE TRIGGER trg_ventas_atendido_ins
  BEFORE INSERT ON public.ventas
  FOR EACH ROW EXECUTE FUNCTION public.ventas_set_atendido();

DROP TRIGGER IF EXISTS trg_ventas_atendido_upd ON public.ventas;
CREATE TRIGGER trg_ventas_atendido_upd
  BEFORE UPDATE ON public.ventas
  FOR EACH ROW EXECUTE FUNCTION public.ventas_set_atendido();

-- Solo admin del tenant o superadmin pueden editar atendido_por_nombre tras crear
DROP POLICY IF EXISTS "ventas_update" ON public.ventas;
CREATE POLICY "ventas_update" ON public.ventas
  FOR UPDATE TO authenticated
  USING (
    is_superadmin()
    OR (tenant_id = current_tenant_id() AND can_manage() AND subscription_allows_writes(tenant_id))
  );

-- ============ FACTURAS: atendido_por ============
ALTER TABLE public.facturas
  ADD COLUMN IF NOT EXISTS atendido_por_nombre text,
  ADD COLUMN IF NOT EXISTS created_by_email text;

CREATE OR REPLACE FUNCTION public.facturas_set_atendido()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_nombre text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT email, nombre_completo INTO v_email, v_nombre
      FROM public.profiles WHERE id = auth.uid();
    NEW.user_id := COALESCE(NEW.user_id, auth.uid());
    NEW.created_by_email := v_email;
    IF NEW.atendido_por_nombre IS NULL OR length(trim(NEW.atendido_por_nombre)) = 0 THEN
      NEW.atendido_por_nombre := COALESCE(v_nombre, v_email);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.user_id := OLD.user_id;
    NEW.created_by_email := OLD.created_by_email;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_facturas_atendido_ins ON public.facturas;
CREATE TRIGGER trg_facturas_atendido_ins
  BEFORE INSERT ON public.facturas
  FOR EACH ROW EXECUTE FUNCTION public.facturas_set_atendido();

DROP TRIGGER IF EXISTS trg_facturas_atendido_upd ON public.facturas;
CREATE TRIGGER trg_facturas_atendido_upd
  BEFORE UPDATE ON public.facturas
  FOR EACH ROW EXECUTE FUNCTION public.facturas_set_atendido();

-- ============ STOCK MOVEMENTS: email snapshot ============
ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS created_by_email text;

CREATE OR REPLACE FUNCTION public.stock_movements_set_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  SELECT email INTO v_email FROM public.profiles WHERE id = auth.uid();
  NEW.user_id := COALESCE(NEW.user_id, auth.uid());
  NEW.created_by_email := v_email;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mov_set_user ON public.stock_movements;
CREATE TRIGGER trg_mov_set_user
  BEFORE INSERT ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.stock_movements_set_user();

-- ============ Función para actualizar atendido_por_nombre (solo admin/superadmin) ============
CREATE OR REPLACE FUNCTION public.actualizar_atendido_venta(_venta_id uuid, _nombre text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
BEGIN
  SELECT tenant_id INTO v_tenant FROM public.ventas WHERE id = _venta_id;
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'Venta no encontrada'; END IF;
  IF NOT (is_superadmin() OR (v_tenant = current_tenant_id() AND is_admin())) THEN
    RAISE EXCEPTION 'Solo el administrador puede editar Atendido por';
  END IF;
  IF _nombre IS NULL OR length(trim(_nombre)) = 0 THEN
    RAISE EXCEPTION 'El nombre no puede estar vacío';
  END IF;
  UPDATE public.ventas
    SET atendido_por_nombre = trim(_nombre),
        updated_at = now()
    WHERE id = _venta_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.actualizar_atendido_factura(_factura_id uuid, _nombre text)
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
    RAISE EXCEPTION 'Solo el administrador puede editar Atendido por';
  END IF;
  IF _nombre IS NULL OR length(trim(_nombre)) = 0 THEN
    RAISE EXCEPTION 'El nombre no puede estar vacío';
  END IF;
  UPDATE public.facturas
    SET atendido_por_nombre = trim(_nombre),
        updated_at = now()
    WHERE id = _factura_id;
END;
$$;
