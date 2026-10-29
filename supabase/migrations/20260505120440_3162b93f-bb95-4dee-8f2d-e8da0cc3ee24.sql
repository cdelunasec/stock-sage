
-- 1. Fix profile tenant switch vulnerability
DROP POLICY IF EXISTS profiles_update_self ON public.profiles;
CREATE POLICY profiles_update_self ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

-- 2. Tenant-scope has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role = _role
      AND ur.tenant_id = public.current_tenant_id()
  )
$$;

-- 3. Block self-promotion to superadmin via user_roles policy
DROP POLICY IF EXISTS roles_admin_manage ON public.user_roles;
CREATE POLICY roles_admin_manage ON public.user_roles
  FOR ALL TO authenticated
  USING ((tenant_id = current_tenant_id()) AND is_admin() AND role <> 'superadmin')
  WITH CHECK ((tenant_id = current_tenant_id()) AND is_admin() AND role <> 'superadmin');

-- 4. cotizacion_items: explicit UPDATE policy
CREATE POLICY ci_update ON public.cotizacion_items
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM cotizaciones c
    WHERE c.id = cotizacion_items.cotizacion_id
      AND (is_superadmin() OR (c.tenant_id = current_tenant_id() AND can_manage() AND subscription_allows_writes(c.tenant_id)))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM cotizaciones c
    WHERE c.id = cotizacion_items.cotizacion_id
      AND (is_superadmin() OR (c.tenant_id = current_tenant_id() AND can_manage() AND subscription_allows_writes(c.tenant_id)))
  ));

-- 5. venta_items: explicit deny for UPDATE/DELETE (append-only via parent eliminar_venta RPC)
CREATE POLICY vi_no_update ON public.venta_items
  AS RESTRICTIVE FOR UPDATE TO authenticated USING (false);
CREATE POLICY vi_no_delete ON public.venta_items
  AS RESTRICTIVE FOR DELETE TO authenticated USING (false);

-- 6. stock_movements: explicit append-only
CREATE POLICY mov_no_update ON public.stock_movements
  AS RESTRICTIVE FOR UPDATE TO authenticated USING (false);
CREATE POLICY mov_no_delete ON public.stock_movements
  AS RESTRICTIVE FOR DELETE TO authenticated USING (false);

-- 7. Revoke EXECUTE on internal SECURITY DEFINER helpers from anon
REVOKE EXECUTE ON FUNCTION public.is_superadmin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_manage() FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_tenant_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.subscription_allows_access(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.subscription_allows_writes(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.my_access_state() FROM anon;
REVOKE EXECUTE ON FUNCTION public.next_factura_correlativo(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.next_ncf(uuid, ncf_tipo) FROM anon;
REVOKE EXECUTE ON FUNCTION public.eliminar_factura(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.eliminar_venta(uuid, text, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.registrar_pago_proveedor(uuid, numeric, text, date, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.apply_stock_movement() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated;
