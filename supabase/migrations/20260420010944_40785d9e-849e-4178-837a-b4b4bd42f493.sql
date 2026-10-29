
-- ============================================
-- 2. FUNCIÓN is_superadmin
-- ============================================
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'superadmin'
  )
$$;

-- ============================================
-- 3. EXTENDER POLÍTICAS PARA SUPERADMIN
-- ============================================
-- Tenants
CREATE POLICY "tenants_superadmin_all" ON public.tenants
  FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

-- Subscriptions
CREATE POLICY "subs_superadmin_all" ON public.subscriptions
  FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

-- Profiles (lectura global para superadmin)
CREATE POLICY "profiles_superadmin_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.is_superadmin());

-- User roles (gestión global)
CREATE POLICY "roles_superadmin_all" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

-- ============================================
-- 4. CAMPOS NUEVOS EN PRODUCTOS (empaques)
-- ============================================
ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS unidad_empaque TEXT,
  ADD COLUMN IF NOT EXISTS unidades_por_empaque INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS permite_venta_empaque BOOLEAN NOT NULL DEFAULT false;

-- ============================================
-- 5. CAMPOS FISCALES EN TENANTS
-- ============================================
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS razon_social TEXT,
  ADD COLUMN IF NOT EXISTS direccion TEXT,
  ADD COLUMN IF NOT EXISTS telefono TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS pie_factura TEXT,
  ADD COLUMN IF NOT EXISTS serie_factura TEXT NOT NULL DEFAULT 'A',
  ADD COLUMN IF NOT EXISTS siguiente_correlativo INTEGER NOT NULL DEFAULT 1;

-- ============================================
-- 6. TABLA tipos_proveedor
-- ============================================
CREATE TABLE IF NOT EXISTS public.tipos_proveedor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, nombre)
);
ALTER TABLE public.tipos_proveedor ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tipo_prov_select" ON public.tipos_proveedor
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_superadmin());

CREATE POLICY "tipo_prov_manage" ON public.tipos_proveedor
  FOR ALL TO authenticated
  USING ((tenant_id = public.current_tenant_id() AND public.can_manage()) OR public.is_superadmin())
  WITH CHECK ((tenant_id = public.current_tenant_id() AND public.can_manage()) OR public.is_superadmin());

-- Tipos por defecto para tenants existentes
INSERT INTO public.tipos_proveedor (tenant_id, nombre)
SELECT t.id, x.nombre
FROM public.tenants t
CROSS JOIN (VALUES ('Mayorista'), ('Importador'), ('Local'), ('Distribuidor'), ('Servicios')) AS x(nombre)
ON CONFLICT DO NOTHING;

-- ============================================
-- 7. TABLA proveedores
-- ============================================
CREATE TABLE IF NOT EXISTS public.proveedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tipo_proveedor_id UUID REFERENCES public.tipos_proveedor(id) ON DELETE SET NULL,
  nombre TEXT NOT NULL,
  contacto TEXT,
  telefono TEXT,
  email TEXT,
  direccion TEXT,
  identificador_fiscal TEXT,
  condiciones_pago TEXT,
  notas TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.proveedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prov_select" ON public.proveedores
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_superadmin());

CREATE POLICY "prov_manage" ON public.proveedores
  FOR ALL TO authenticated
  USING ((tenant_id = public.current_tenant_id() AND public.can_manage()) OR public.is_superadmin())
  WITH CHECK ((tenant_id = public.current_tenant_id() AND public.can_manage()) OR public.is_superadmin());

CREATE TRIGGER trg_proveedores_updated
  BEFORE UPDATE ON public.proveedores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 8. TABLA producto_proveedores
-- ============================================
CREATE TABLE IF NOT EXISTS public.producto_proveedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,
  proveedor_id UUID NOT NULL REFERENCES public.proveedores(id) ON DELETE CASCADE,
  precio_compra NUMERIC(14,2) DEFAULT 0,
  codigo_proveedor TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (producto_id, proveedor_id)
);
ALTER TABLE public.producto_proveedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pp_select" ON public.producto_proveedores
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_superadmin());

CREATE POLICY "pp_manage" ON public.producto_proveedores
  FOR ALL TO authenticated
  USING ((tenant_id = public.current_tenant_id() AND public.can_manage()) OR public.is_superadmin())
  WITH CHECK ((tenant_id = public.current_tenant_id() AND public.can_manage()) OR public.is_superadmin());

-- ============================================
-- 9. proveedor_id en stock_movements
-- ============================================
ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS proveedor_id UUID REFERENCES public.proveedores(id) ON DELETE SET NULL;

-- ============================================
-- 10. TABLA facturas
-- ============================================
CREATE TABLE IF NOT EXISTS public.facturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  venta_id UUID REFERENCES public.ventas(id) ON DELETE SET NULL,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  serie TEXT NOT NULL DEFAULT 'A',
  correlativo INTEGER NOT NULL,
  numero_factura TEXT GENERATED ALWAYS AS (serie || '-' || LPAD(correlativo::text, 6, '0')) STORED,
  fecha_emision TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_vencimiento TIMESTAMPTZ,
  condicion_pago TEXT NOT NULL DEFAULT 'contado',
  metodo_pago TEXT,
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  descuento NUMERIC(14,2) NOT NULL DEFAULT 0,
  impuesto NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'emitida',
  notas TEXT,
  datos_emisor JSONB,
  datos_cliente JSONB,
  user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, serie, correlativo)
);
ALTER TABLE public.facturas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fact_select" ON public.facturas
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_superadmin());

CREATE POLICY "fact_insert" ON public.facturas
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.can_manage());

CREATE POLICY "fact_update" ON public.facturas
  FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.can_manage());

CREATE TRIGGER trg_facturas_updated
  BEFORE UPDATE ON public.facturas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 11. TABLA factura_items
-- ============================================
CREATE TABLE IF NOT EXISTS public.factura_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factura_id UUID NOT NULL REFERENCES public.facturas(id) ON DELETE CASCADE,
  producto_id UUID REFERENCES public.productos(id) ON DELETE SET NULL,
  codigo TEXT,
  descripcion TEXT NOT NULL,
  cantidad NUMERIC(14,2) NOT NULL,
  unidad TEXT,
  precio_unitario NUMERIC(14,2) NOT NULL,
  descuento_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  impuesto_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(14,2) NOT NULL,
  presentacion TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.factura_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fi_select" ON public.factura_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.facturas f
    WHERE f.id = factura_items.factura_id
      AND (f.tenant_id = public.current_tenant_id() OR public.is_superadmin())
  ));

CREATE POLICY "fi_insert" ON public.factura_items
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.facturas f
    WHERE f.id = factura_items.factura_id
      AND f.tenant_id = public.current_tenant_id()
      AND public.can_manage()
  ));

-- ============================================
-- 12. ASIGNAR SUPERADMIN A empresasdeluna@gmail.com
-- ============================================
DO $$
DECLARE
  v_user_id UUID;
  v_tenant_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'empresasdeluna@gmail.com' LIMIT 1;
  IF v_user_id IS NOT NULL THEN
    SELECT tenant_id INTO v_tenant_id FROM public.profiles WHERE id = v_user_id LIMIT 1;
    IF v_tenant_id IS NOT NULL THEN
      INSERT INTO public.user_roles (user_id, tenant_id, role)
      VALUES (v_user_id, v_tenant_id, 'superadmin')
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
END $$;
