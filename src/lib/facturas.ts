import { supabase } from "@/integrations/supabase/client";

export interface FacturarParams {
  tenant_id: string;
  venta_id?: string | null;
  cliente_id?: string | null;
  user_id?: string | null;
  atendido_por_nombre?: string | null;
  condicion_pago?: "contado" | "credito";
  metodo_pago?: string | null;
  fecha_vencimiento?: string | null;
  notas?: string | null;
  ncf_tipo?: "B01" | "B02" | "B14" | "B15" | null;
  items: Array<{
    producto_id?: string | null;
    codigo?: string | null;
    descripcion: string;
    cantidad: number;
    unidad?: string | null;
    precio_unitario: number;
    precio_original?: number | null;
    descuento_motivo?: string | null;
    descuento_pct?: number;
    impuesto_pct?: number;
    presentacion?: string | null;
  }>;
}

/**
 * Crea factura tomando serie/correlativo del tenant y avanzándolo.
 * Devuelve el id de la factura creada.
 */
export async function generarFactura(p: FacturarParams): Promise<string> {
  // 1) Obtener tenant (datos emisor) y reservar correlativo de forma atómica
  const { data: t, error: te } = await supabase
    .from("tenants")
    .select("id, nombre, razon_social, identificador_fiscal, direccion, telefono, email, moneda, pie_factura, serie_factura, logo_url, color_primario")
    .eq("id", p.tenant_id)
    .maybeSingle();
  if (te || !t) throw new Error(te?.message || "Tenant no encontrado");

  const { data: nextCorr, error: corrErr } = await supabase.rpc("next_factura_correlativo", { _tenant_id: p.tenant_id });
  if (corrErr || nextCorr == null) throw new Error(corrErr?.message || "No se pudo reservar el número de factura");
  const correlativo = Number(nextCorr);
  const serie = (t as any).serie_factura || "A";

  // 2) Snapshot cliente
  let datosCliente: any = null;
  if (p.cliente_id) {
    const { data: c } = await supabase.from("clientes").select("*").eq("id", p.cliente_id).maybeSingle();
    datosCliente = c;
  }

  // 3) Calcular totales
  let subtotal = 0, impuesto = 0;
  p.items.forEach((it) => {
    const lineSub = it.cantidad * it.precio_unitario * (1 - (it.descuento_pct || 0) / 100);
    subtotal += lineSub;
    impuesto += lineSub * ((it.impuesto_pct || 0) / 100);
  });
  const total = subtotal + impuesto;

  // 3.5) Asignar NCF si aplica
  let ncf: string | null = null;
  if (p.ncf_tipo) {
    const { data: ncfData, error: ncfErr } = await supabase.rpc("next_ncf", {
      _tenant_id: p.tenant_id,
      _tipo: p.ncf_tipo,
    });
    if (ncfErr) throw new Error("NCF: " + ncfErr.message);
    ncf = ncfData as string;
  }

  // 4) Insertar factura
  const { data: f, error: fe } = await supabase.from("facturas").insert({
    tenant_id: p.tenant_id,
    venta_id: p.venta_id || null,
    cliente_id: p.cliente_id || null,
    serie,
    correlativo,
    fecha_emision: new Date().toISOString(),
    fecha_vencimiento: p.fecha_vencimiento || null,
    condicion_pago: p.condicion_pago || "contado",
    metodo_pago: p.metodo_pago || null,
    subtotal, descuento: 0, impuesto, total,
    estado: "emitida",
    notas: p.notas || null,
    user_id: p.user_id || null,
    atendido_por_nombre: p.atendido_por_nombre || null,
    ncf,
    ncf_tipo: p.ncf_tipo || null,
    datos_emisor: {
      nombre: t.nombre,
      razon_social: (t as any).razon_social,
      identificador_fiscal: (t as any).identificador_fiscal,
      direccion: (t as any).direccion,
      telefono: (t as any).telefono,
      email: (t as any).email,
      pie_factura: (t as any).pie_factura,
      logo_url: (t as any).logo_url,
      color_primario: (t as any).color_primario,
    },
    datos_cliente: datosCliente,
  } as any).select().single();

  if (fe || !f) throw new Error(fe?.message || "Error al crear factura");

  // 5) Insertar items
  const itemsPayload = p.items.map((it) => {
    const original = it.precio_original ?? it.precio_unitario;
    const descPct = it.descuento_pct ?? (original > 0 ? Math.max(0, ((original - it.precio_unitario) / original) * 100) : 0);
    const lineSub = it.cantidad * it.precio_unitario;
    return {
      factura_id: f.id,
      producto_id: it.producto_id || null,
      codigo: it.codigo || null,
      descripcion: it.descripcion,
      cantidad: it.cantidad,
      unidad: it.unidad || null,
      precio_unitario: it.precio_unitario,
      precio_original: original,
      descuento_motivo: it.descuento_motivo || null,
      descuento_pct: descPct,
      impuesto_pct: it.impuesto_pct || 0,
      subtotal: lineSub,
      presentacion: it.presentacion || null,
    };
  });
  const { error: ie } = await supabase.from("factura_items").insert(itemsPayload);
  if (ie) throw new Error(ie.message);
  // El correlativo ya fue avanzado atómicamente por next_factura_correlativo en el paso 1.

  return f.id;
}
