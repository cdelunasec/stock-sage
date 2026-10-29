
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin', 'supervisor', 'empleado');
CREATE TYPE public.plan_tipo AS ENUM ('basico', 'profesional', 'empresarial');
CREATE TYPE public.subscription_status AS ENUM ('activa', 'vencida', 'cancelada', 'prueba');
CREATE TYPE public.movimiento_tipo AS ENUM ('entrada', 'salida', 'ajuste', 'transferencia', 'venta', 'devolucion');
CREATE TYPE public.venta_estado AS ENUM ('completada', 'devuelta', 'anulada');

-- ============ HELPER: timestamps ============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ============ TENANTS ============
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  identificador_fiscal TEXT,
  moneda TEXT NOT NULL DEFAULT 'USD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_tenants_updated BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nombre_completo TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_profiles_tenant ON public.profiles(tenant_id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, tenant_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============ SECURITY DEFINER FUNCTIONS ============
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin')
$$;

CREATE OR REPLACE FUNCTION public.can_manage()
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor')
$$;

-- ============ SUBSCRIPTIONS ============
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan public.plan_tipo NOT NULL DEFAULT 'basico',
  status public.subscription_status NOT NULL DEFAULT 'prueba',
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  max_usuarios INT NOT NULL DEFAULT 3,
  max_productos INT NOT NULL DEFAULT 100,
  max_almacenes INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_subs_updated BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ CATEGORIAS ============
CREATE TABLE public.categorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, nombre)
);
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_categorias_tenant ON public.categorias(tenant_id);
CREATE TRIGGER trg_cat_updated BEFORE UPDATE ON public.categorias FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ ALMACENES ============
CREATE TABLE public.almacenes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  direccion TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.almacenes ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_almacenes_tenant ON public.almacenes(tenant_id);
CREATE TRIGGER trg_alm_updated BEFORE UPDATE ON public.almacenes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ PRODUCTOS ============
CREATE TABLE public.productos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  categoria_id UUID REFERENCES public.categorias(id) ON DELETE SET NULL,
  sku TEXT NOT NULL,
  codigo_barras TEXT,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  unidad TEXT NOT NULL DEFAULT 'unidad',
  precio_costo NUMERIC(14,2) NOT NULL DEFAULT 0,
  precio_venta NUMERIC(14,2) NOT NULL DEFAULT 0,
  impuesto_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  stock_minimo NUMERIC(14,2) NOT NULL DEFAULT 0,
  imagen_url TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, sku)
);
ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_productos_tenant ON public.productos(tenant_id);
CREATE INDEX idx_productos_nombre ON public.productos(tenant_id, nombre);
CREATE TRIGGER trg_prod_updated BEFORE UPDATE ON public.productos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ STOCK LEVELS ============
CREATE TABLE public.stock_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,
  almacen_id UUID NOT NULL REFERENCES public.almacenes(id) ON DELETE CASCADE,
  cantidad NUMERIC(14,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(producto_id, almacen_id)
);
ALTER TABLE public.stock_levels ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_stock_tenant ON public.stock_levels(tenant_id);
CREATE TRIGGER trg_stock_updated BEFORE UPDATE ON public.stock_levels FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ STOCK MOVEMENTS ============
CREATE TABLE public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,
  almacen_id UUID NOT NULL REFERENCES public.almacenes(id) ON DELETE CASCADE,
  almacen_destino_id UUID REFERENCES public.almacenes(id) ON DELETE SET NULL,
  tipo public.movimiento_tipo NOT NULL,
  cantidad NUMERIC(14,2) NOT NULL,
  costo_unitario NUMERIC(14,2),
  referencia TEXT,
  notas TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_mov_tenant ON public.stock_movements(tenant_id);
CREATE INDEX idx_mov_producto ON public.stock_movements(producto_id, created_at DESC);

-- Trigger: aplicar movimiento al stock_levels
CREATE OR REPLACE FUNCTION public.apply_stock_movement()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_delta NUMERIC(14,2);
BEGIN
  IF NEW.tipo IN ('entrada', 'devolucion') THEN
    v_delta := NEW.cantidad;
  ELSIF NEW.tipo IN ('salida', 'venta') THEN
    v_delta := -NEW.cantidad;
  ELSIF NEW.tipo = 'ajuste' THEN
    v_delta := NEW.cantidad; -- puede ser negativo
  ELSIF NEW.tipo = 'transferencia' THEN
    -- restar del origen
    INSERT INTO public.stock_levels (tenant_id, producto_id, almacen_id, cantidad)
    VALUES (NEW.tenant_id, NEW.producto_id, NEW.almacen_id, -NEW.cantidad)
    ON CONFLICT (producto_id, almacen_id)
    DO UPDATE SET cantidad = stock_levels.cantidad - NEW.cantidad, updated_at = now();
    -- sumar al destino
    IF NEW.almacen_destino_id IS NOT NULL THEN
      INSERT INTO public.stock_levels (tenant_id, producto_id, almacen_id, cantidad)
      VALUES (NEW.tenant_id, NEW.producto_id, NEW.almacen_destino_id, NEW.cantidad)
      ON CONFLICT (producto_id, almacen_id)
      DO UPDATE SET cantidad = stock_levels.cantidad + NEW.cantidad, updated_at = now();
    END IF;
    RETURN NEW;
  END IF;

  INSERT INTO public.stock_levels (tenant_id, producto_id, almacen_id, cantidad)
  VALUES (NEW.tenant_id, NEW.producto_id, NEW.almacen_id, v_delta)
  ON CONFLICT (producto_id, almacen_id)
  DO UPDATE SET cantidad = stock_levels.cantidad + v_delta, updated_at = now();

  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_apply_movement AFTER INSERT ON public.stock_movements
FOR EACH ROW EXECUTE FUNCTION public.apply_stock_movement();

-- ============ CLIENTES ============
CREATE TABLE public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  identificador_fiscal TEXT,
  email TEXT,
  telefono TEXT,
  direccion TEXT,
  credito_disponible NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_clientes_tenant ON public.clientes(tenant_id);
CREATE TRIGGER trg_cli_updated BEFORE UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ VENTAS ============
CREATE TABLE public.ventas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  numero SERIAL,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  almacen_id UUID NOT NULL REFERENCES public.almacenes(id) ON DELETE RESTRICT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  estado public.venta_estado NOT NULL DEFAULT 'completada',
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  impuesto NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ventas ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_ventas_tenant ON public.ventas(tenant_id, created_at DESC);
CREATE TRIGGER trg_ventas_updated BEFORE UPDATE ON public.ventas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.venta_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id UUID NOT NULL REFERENCES public.ventas(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES public.productos(id) ON DELETE RESTRICT,
  cantidad NUMERIC(14,2) NOT NULL,
  precio_unitario NUMERIC(14,2) NOT NULL,
  impuesto_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(14,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.venta_items ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_venta_items_venta ON public.venta_items(venta_id);

-- ============ AUDIT LOG ============
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  accion TEXT NOT NULL,
  entidad TEXT NOT NULL,
  entidad_id UUID,
  datos JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_audit_tenant ON public.audit_log(tenant_id, created_at DESC);

-- ============ HANDLE NEW USER ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tenant_id UUID;
  v_empresa TEXT;
  v_nombre TEXT;
BEGIN
  v_empresa := COALESCE(NEW.raw_user_meta_data->>'empresa_nombre', 'Mi Empresa');
  v_nombre := COALESCE(NEW.raw_user_meta_data->>'nombre_completo', NEW.email);

  INSERT INTO public.tenants (nombre) VALUES (v_empresa) RETURNING id INTO v_tenant_id;

  INSERT INTO public.profiles (id, tenant_id, nombre_completo, email)
  VALUES (NEW.id, v_tenant_id, v_nombre, NEW.email);

  INSERT INTO public.user_roles (user_id, tenant_id, role)
  VALUES (NEW.id, v_tenant_id, 'admin');

  INSERT INTO public.subscriptions (tenant_id, plan, status)
  VALUES (v_tenant_id, 'basico', 'prueba');

  -- Almacén principal por defecto
  INSERT INTO public.almacenes (tenant_id, nombre, direccion)
  VALUES (v_tenant_id, 'Almacén Principal', NULL);

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ RLS POLICIES ============
-- TENANTS
CREATE POLICY "tenants_select_own" ON public.tenants FOR SELECT TO authenticated USING (id = public.current_tenant_id());
CREATE POLICY "tenants_update_admin" ON public.tenants FOR UPDATE TO authenticated USING (id = public.current_tenant_id() AND public.is_admin());

-- PROFILES
CREATE POLICY "profiles_select_same_tenant" ON public.profiles FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id());
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());

-- USER_ROLES
CREATE POLICY "roles_select_own_tenant" ON public.user_roles FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id());
CREATE POLICY "roles_admin_manage" ON public.user_roles FOR ALL TO authenticated USING (tenant_id = public.current_tenant_id() AND public.is_admin()) WITH CHECK (tenant_id = public.current_tenant_id() AND public.is_admin());

-- SUBSCRIPTIONS
CREATE POLICY "subs_select_own" ON public.subscriptions FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id());

-- Helper macro de RLS (tenant + permisos)
-- CATEGORIAS
CREATE POLICY "cat_select" ON public.categorias FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id());
CREATE POLICY "cat_manage" ON public.categorias FOR ALL TO authenticated USING (tenant_id = public.current_tenant_id() AND public.can_manage()) WITH CHECK (tenant_id = public.current_tenant_id() AND public.can_manage());

-- ALMACENES
CREATE POLICY "alm_select" ON public.almacenes FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id());
CREATE POLICY "alm_manage" ON public.almacenes FOR ALL TO authenticated USING (tenant_id = public.current_tenant_id() AND public.is_admin()) WITH CHECK (tenant_id = public.current_tenant_id() AND public.is_admin());

-- PRODUCTOS
CREATE POLICY "prod_select" ON public.productos FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id());
CREATE POLICY "prod_manage" ON public.productos FOR ALL TO authenticated USING (tenant_id = public.current_tenant_id() AND public.can_manage()) WITH CHECK (tenant_id = public.current_tenant_id() AND public.can_manage());

-- STOCK LEVELS
CREATE POLICY "stock_select" ON public.stock_levels FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id());
CREATE POLICY "stock_manage" ON public.stock_levels FOR ALL TO authenticated USING (tenant_id = public.current_tenant_id() AND public.can_manage()) WITH CHECK (tenant_id = public.current_tenant_id() AND public.can_manage());

-- STOCK MOVEMENTS
CREATE POLICY "mov_select" ON public.stock_movements FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id());
CREATE POLICY "mov_insert" ON public.stock_movements FOR INSERT TO authenticated WITH CHECK (tenant_id = public.current_tenant_id());

-- CLIENTES
CREATE POLICY "cli_select" ON public.clientes FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id());
CREATE POLICY "cli_manage" ON public.clientes FOR ALL TO authenticated USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id());

-- VENTAS
CREATE POLICY "ventas_select" ON public.ventas FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id());
CREATE POLICY "ventas_insert" ON public.ventas FOR INSERT TO authenticated WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "ventas_update" ON public.ventas FOR UPDATE TO authenticated USING (tenant_id = public.current_tenant_id() AND public.can_manage());

-- VENTA ITEMS
CREATE POLICY "vi_select" ON public.venta_items FOR SELECT TO authenticated USING (EXISTS(SELECT 1 FROM public.ventas v WHERE v.id = venta_id AND v.tenant_id = public.current_tenant_id()));
CREATE POLICY "vi_insert" ON public.venta_items FOR INSERT TO authenticated WITH CHECK (EXISTS(SELECT 1 FROM public.ventas v WHERE v.id = venta_id AND v.tenant_id = public.current_tenant_id()));

-- AUDIT
CREATE POLICY "audit_select_admin" ON public.audit_log FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id() AND public.is_admin());
CREATE POLICY "audit_insert" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (tenant_id = public.current_tenant_id());
