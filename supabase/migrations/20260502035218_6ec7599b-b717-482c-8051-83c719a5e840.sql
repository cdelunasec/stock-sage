
-- 1) Añadir 'eliminada' al enum venta_estado si no existe
ALTER TYPE public.venta_estado ADD VALUE IF NOT EXISTS 'eliminada';

-- 2) Columnas nuevas en ventas
ALTER TABLE public.ventas
  ADD COLUMN IF NOT EXISTS motivo_eliminacion text,
  ADD COLUMN IF NOT EXISTS devolver_stock boolean,
  ADD COLUMN IF NOT EXISTS eliminada_en timestamptz,
  ADD COLUMN IF NOT EXISTS eliminada_por uuid;

-- 3) Política DELETE en ventas (solo admin del tenant) — necesaria para algún caso futuro,
-- pero la lógica oficial pasa por la RPC.
DROP POLICY IF EXISTS ventas_delete_admin ON public.ventas;
CREATE POLICY ventas_delete_admin ON public.ventas
  FOR DELETE TO authenticated
  USING (is_superadmin() OR (tenant_id = current_tenant_id() AND is_admin()));

-- 4) Función para eliminar (marcar) una venta con trazabilidad
CREATE OR REPLACE FUNCTION public.eliminar_venta(
  _venta_id uuid,
  _motivo text,
  _devolver_stock boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
  v_estado venta_estado;
  v_almacen uuid;
  v_numero int;
  v_uid uuid := auth.uid();
  it record;
BEGIN
  SELECT tenant_id, estado, almacen_id, numero
    INTO v_tenant, v_estado, v_almacen, v_numero
  FROM public.ventas WHERE id = _venta_id;

  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'Venta no encontrada';
  END IF;

  -- Solo admin del tenant o superadmin
  IF NOT (public.is_superadmin() OR (v_tenant = public.current_tenant_id() AND public.is_admin())) THEN
    RAISE EXCEPTION 'No autorizado para eliminar ventas';
  END IF;

  IF v_estado = 'eliminada' THEN
    RAISE EXCEPTION 'La venta ya está eliminada';
  END IF;

  -- Si se solicita devolver stock y la venta estaba completada, generar movimientos de devolución
  IF COALESCE(_devolver_stock, false) AND v_estado = 'completada' THEN
    FOR it IN
      SELECT producto_id, cantidad
      FROM public.venta_items
      WHERE venta_id = _venta_id AND producto_id IS NOT NULL
    LOOP
      INSERT INTO public.stock_movements (
        tenant_id, producto_id, almacen_id, tipo, cantidad, referencia, notas, user_id
      ) VALUES (
        v_tenant, it.producto_id, v_almacen, 'devolucion', it.cantidad,
        'Eliminación venta #' || v_numero,
        COALESCE(_motivo, 'Devolución por eliminación'),
        v_uid
      );
    END LOOP;
  END IF;

  -- Marcar la venta como eliminada conservando datos
  UPDATE public.ventas
     SET estado = 'eliminada',
         motivo_eliminacion = _motivo,
         devolver_stock = COALESCE(_devolver_stock, false),
         eliminada_en = now(),
         eliminada_por = v_uid,
         updated_at = now()
   WHERE id = _venta_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.eliminar_venta(uuid, text, boolean) TO authenticated;
