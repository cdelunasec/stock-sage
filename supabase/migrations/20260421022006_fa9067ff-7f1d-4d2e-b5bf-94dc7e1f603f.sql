-- Función: ¿la suscripción del tenant permite acceso (lectura)?
CREATE OR REPLACE FUNCTION public.subscription_allows_access(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE tenant_id = _tenant_id
      AND status IN ('activa', 'prueba', 'vencida')
  )
$$;

-- Función: ¿la suscripción del tenant permite escritura?
CREATE OR REPLACE FUNCTION public.subscription_allows_writes(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE tenant_id = _tenant_id
      AND status IN ('activa', 'prueba')
      AND expires_at > now()
  )
$$;

-- Función: estado de suscripción del usuario actual (para el frontend)
CREATE OR REPLACE FUNCTION public.my_access_state()
RETURNS TABLE(status text, expires_at timestamptz, allows_access boolean, allows_writes boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.status::text,
    s.expires_at,
    (s.status IN ('activa','prueba','vencida')) AS allows_access,
    (s.status IN ('activa','prueba') AND s.expires_at > now()) AS allows_writes
  FROM public.profiles p
  JOIN public.subscriptions s ON s.tenant_id = p.tenant_id
  WHERE p.id = auth.uid()
  LIMIT 1
$$;

-- ============== Actualizar políticas RLS ==============
-- Patrón: SELECT permitido si subscription_allows_access; manage si subscription_allows_writes
-- Superadmin siempre pasa.

-- ALMACENES
DROP POLICY IF EXISTS alm_select ON public.almacenes;
DROP POLICY IF EXISTS alm_manage ON public.almacenes;
CREATE POLICY alm_select ON public.almacenes FOR SELECT TO authenticated
USING (is_superadmin() OR (tenant_id = current_tenant_id() AND subscription_allows_access(tenant_id)));
CREATE POLICY alm_manage ON public.almacenes FOR ALL TO authenticated
USING (is_superadmin() OR (tenant_id = current_tenant_id() AND is_admin() AND subscription_allows_writes(tenant_id)))
WITH CHECK (is_superadmin() OR (tenant_id = current_tenant_id() AND is_admin() AND subscription_allows_writes(tenant_id)));

-- CATEGORIAS
DROP POLICY IF EXISTS cat_select ON public.categorias;
DROP POLICY IF EXISTS cat_manage ON public.categorias;
CREATE POLICY cat_select ON public.categorias FOR SELECT TO authenticated
USING (is_superadmin() OR (tenant_id = current_tenant_id() AND subscription_allows_access(tenant_id)));
CREATE POLICY cat_manage ON public.categorias FOR ALL TO authenticated
USING (is_superadmin() OR (tenant_id = current_tenant_id() AND can_manage() AND subscription_allows_writes(tenant_id)))
WITH CHECK (is_superadmin() OR (tenant_id = current_tenant_id() AND can_manage() AND subscription_allows_writes(tenant_id)));

-- CLIENTES
DROP POLICY IF EXISTS cli_select ON public.clientes;
DROP POLICY IF EXISTS cli_manage ON public.clientes;
CREATE POLICY cli_select ON public.clientes FOR SELECT TO authenticated
USING (is_superadmin() OR (tenant_id = current_tenant_id() AND subscription_allows_access(tenant_id)));
CREATE POLICY cli_manage ON public.clientes FOR ALL TO authenticated
USING (is_superadmin() OR (tenant_id = current_tenant_id() AND subscription_allows_writes(tenant_id)))
WITH CHECK (is_superadmin() OR (tenant_id = current_tenant_id() AND subscription_allows_writes(tenant_id)));

-- PRODUCTOS
DROP POLICY IF EXISTS prod_select ON public.productos;
DROP POLICY IF EXISTS prod_manage ON public.productos;
CREATE POLICY prod_select ON public.productos FOR SELECT TO authenticated
USING (is_superadmin() OR (tenant_id = current_tenant_id() AND subscription_allows_access(tenant_id)));
CREATE POLICY prod_manage ON public.productos FOR ALL TO authenticated
USING (is_superadmin() OR (tenant_id = current_tenant_id() AND can_manage() AND subscription_allows_writes(tenant_id)))
WITH CHECK (is_superadmin() OR (tenant_id = current_tenant_id() AND can_manage() AND subscription_allows_writes(tenant_id)));

-- STOCK_LEVELS
DROP POLICY IF EXISTS stock_select ON public.stock_levels;
DROP POLICY IF EXISTS stock_manage ON public.stock_levels;
CREATE POLICY stock_select ON public.stock_levels FOR SELECT TO authenticated
USING (is_superadmin() OR (tenant_id = current_tenant_id() AND subscription_allows_access(tenant_id)));
CREATE POLICY stock_manage ON public.stock_levels FOR ALL TO authenticated
USING (is_superadmin() OR (tenant_id = current_tenant_id() AND can_manage() AND subscription_allows_writes(tenant_id)))
WITH CHECK (is_superadmin() OR (tenant_id = current_tenant_id() AND can_manage() AND subscription_allows_writes(tenant_id)));

-- STOCK_MOVEMENTS
DROP POLICY IF EXISTS mov_select ON public.stock_movements;
DROP POLICY IF EXISTS mov_insert ON public.stock_movements;
CREATE POLICY mov_select ON public.stock_movements FOR SELECT TO authenticated
USING (is_superadmin() OR (tenant_id = current_tenant_id() AND subscription_allows_access(tenant_id)));
CREATE POLICY mov_insert ON public.stock_movements FOR INSERT TO authenticated
WITH CHECK (is_superadmin() OR (tenant_id = current_tenant_id() AND subscription_allows_writes(tenant_id)));

-- VENTAS
DROP POLICY IF EXISTS ventas_select ON public.ventas;
DROP POLICY IF EXISTS ventas_insert ON public.ventas;
DROP POLICY IF EXISTS ventas_update ON public.ventas;
CREATE POLICY ventas_select ON public.ventas FOR SELECT TO authenticated
USING (is_superadmin() OR (tenant_id = current_tenant_id() AND subscription_allows_access(tenant_id)));
CREATE POLICY ventas_insert ON public.ventas FOR INSERT TO authenticated
WITH CHECK (is_superadmin() OR (tenant_id = current_tenant_id() AND subscription_allows_writes(tenant_id)));
CREATE POLICY ventas_update ON public.ventas FOR UPDATE TO authenticated
USING (is_superadmin() OR (tenant_id = current_tenant_id() AND can_manage() AND subscription_allows_writes(tenant_id)));

-- VENTA_ITEMS
DROP POLICY IF EXISTS vi_select ON public.venta_items;
DROP POLICY IF EXISTS vi_insert ON public.venta_items;
CREATE POLICY vi_select ON public.venta_items FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM ventas v WHERE v.id = venta_items.venta_id
  AND (is_superadmin() OR (v.tenant_id = current_tenant_id() AND subscription_allows_access(v.tenant_id)))));
CREATE POLICY vi_insert ON public.venta_items FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM ventas v WHERE v.id = venta_items.venta_id
  AND (is_superadmin() OR (v.tenant_id = current_tenant_id() AND subscription_allows_writes(v.tenant_id)))));

-- FACTURAS
DROP POLICY IF EXISTS fact_select ON public.facturas;
DROP POLICY IF EXISTS fact_insert ON public.facturas;
DROP POLICY IF EXISTS fact_update ON public.facturas;
CREATE POLICY fact_select ON public.facturas FOR SELECT TO authenticated
USING (is_superadmin() OR (tenant_id = current_tenant_id() AND subscription_allows_access(tenant_id)));
CREATE POLICY fact_insert ON public.facturas FOR INSERT TO authenticated
WITH CHECK (is_superadmin() OR (tenant_id = current_tenant_id() AND can_manage() AND subscription_allows_writes(tenant_id)));
CREATE POLICY fact_update ON public.facturas FOR UPDATE TO authenticated
USING (is_superadmin() OR (tenant_id = current_tenant_id() AND can_manage() AND subscription_allows_writes(tenant_id)));

-- FACTURA_ITEMS
DROP POLICY IF EXISTS fi_select ON public.factura_items;
DROP POLICY IF EXISTS fi_insert ON public.factura_items;
CREATE POLICY fi_select ON public.factura_items FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM facturas f WHERE f.id = factura_items.factura_id
  AND (is_superadmin() OR (f.tenant_id = current_tenant_id() AND subscription_allows_access(f.tenant_id)))));
CREATE POLICY fi_insert ON public.factura_items FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM facturas f WHERE f.id = factura_items.factura_id
  AND (is_superadmin() OR (f.tenant_id = current_tenant_id() AND can_manage() AND subscription_allows_writes(f.tenant_id)))));

-- PROVEEDORES
DROP POLICY IF EXISTS prov_select ON public.proveedores;
DROP POLICY IF EXISTS prov_manage ON public.proveedores;
CREATE POLICY prov_select ON public.proveedores FOR SELECT TO authenticated
USING (is_superadmin() OR (tenant_id = current_tenant_id() AND subscription_allows_access(tenant_id)));
CREATE POLICY prov_manage ON public.proveedores FOR ALL TO authenticated
USING (is_superadmin() OR (tenant_id = current_tenant_id() AND can_manage() AND subscription_allows_writes(tenant_id)))
WITH CHECK (is_superadmin() OR (tenant_id = current_tenant_id() AND can_manage() AND subscription_allows_writes(tenant_id)));

-- TIPOS_PROVEEDOR
DROP POLICY IF EXISTS tipo_prov_select ON public.tipos_proveedor;
DROP POLICY IF EXISTS tipo_prov_manage ON public.tipos_proveedor;
CREATE POLICY tipo_prov_select ON public.tipos_proveedor FOR SELECT TO authenticated
USING (is_superadmin() OR (tenant_id = current_tenant_id() AND subscription_allows_access(tenant_id)));
CREATE POLICY tipo_prov_manage ON public.tipos_proveedor FOR ALL TO authenticated
USING (is_superadmin() OR (tenant_id = current_tenant_id() AND can_manage() AND subscription_allows_writes(tenant_id)))
WITH CHECK (is_superadmin() OR (tenant_id = current_tenant_id() AND can_manage() AND subscription_allows_writes(tenant_id)));

-- PRODUCTO_PROVEEDORES
DROP POLICY IF EXISTS pp_select ON public.producto_proveedores;
DROP POLICY IF EXISTS pp_manage ON public.producto_proveedores;
CREATE POLICY pp_select ON public.producto_proveedores FOR SELECT TO authenticated
USING (is_superadmin() OR (tenant_id = current_tenant_id() AND subscription_allows_access(tenant_id)));
CREATE POLICY pp_manage ON public.producto_proveedores FOR ALL TO authenticated
USING (is_superadmin() OR (tenant_id = current_tenant_id() AND can_manage() AND subscription_allows_writes(tenant_id)))
WITH CHECK (is_superadmin() OR (tenant_id = current_tenant_id() AND can_manage() AND subscription_allows_writes(tenant_id)));