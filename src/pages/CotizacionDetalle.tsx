import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Printer, ShoppingCart, Check, X, Send } from "lucide-react";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { toast } from "sonner";
import { useConfirm } from "@/components/ConfirmDialog";

export default function CotizacionDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { tenant, user, canManage } = useAuth();
  const { confirm, dialog } = useConfirm();
  const [cot, setCot] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [working, setWorking] = useState(false);

  const load = async () => {
    if (!id) return;
    const { data: c, error: ce } = await (supabase as any)
      .from("cotizaciones")
      .select("*")
      .eq("id", id).maybeSingle();
    if (ce) { toast.error(ce.message); return; }
    if (!c) { setCot({ __notfound: true }); return; }

    // Cargar relaciones por separado (sin FKs declaradas)
    let clientes: any = null;
    if (c.cliente_id) {
      const { data } = await supabase.from("clientes")
        .select("id, nombre, identificador_fiscal, email").eq("id", c.cliente_id).maybeSingle();
      clientes = data;
    }
    const { data: alm } = await supabase.from("almacenes")
      .select("id, nombre").eq("id", c.almacen_id).maybeSingle();
    setCot({ ...c, clientes, almacenes: alm });

    const { data: it } = await (supabase as any)
      .from("cotizacion_items")
      .select("*")
      .eq("cotizacion_id", id);
    const rawItems = it || [];
    const prodIds = rawItems.filter((x: any) => x.producto_id).map((x: any) => x.producto_id);
    const servIds = rawItems.filter((x: any) => x.servicio_id).map((x: any) => x.servicio_id);
    const [{ data: prods }, { data: servs }] = await Promise.all([
      prodIds.length ? supabase.from("productos").select("id, nombre, sku, unidad").in("id", prodIds) : Promise.resolve({ data: [] as any[] }),
      servIds.length ? (supabase as any).from("servicios").select("id, nombre").in("id", servIds) : Promise.resolve({ data: [] as any[] }),
    ]);
    const pMap = new Map((prods || []).map((p: any) => [p.id, p]));
    const sMap = new Map((servs || []).map((s: any) => [s.id, s]));
    setItems(rawItems.map((x: any) => ({
      ...x,
      productos: x.producto_id ? pMap.get(x.producto_id) : null,
      servicios: x.servicio_id ? sMap.get(x.servicio_id) : null,
    })));
  };
  useEffect(() => { load(); }, [id]);

  const cambiarEstado = async (estado: string) => {
    const { error } = await (supabase as any).from("cotizaciones").update({ estado }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Estado actualizado");
    load();
  };

  const convertirAVenta = async () => {
    if (!cot || !tenant) return;
    const ok = await confirm({
      title: "¿Convertir en venta?",
      description: "Se generará una venta y se descontará el stock de los productos. Esta acción no se puede deshacer.",
      confirmText: "Convertir",
    });
    if (!ok) return;
    setWorking(true);

    // Validar stock por producto en el almacén de la cotización
    const productoItems = items.filter((i) => i.producto_id);
    if (productoItems.length > 0) {
      const ids = productoItems.map((i) => i.producto_id);
      const { data: stock } = await supabase
        .from("stock_levels")
        .select("producto_id, cantidad")
        .eq("almacen_id", cot.almacen_id)
        .in("producto_id", ids);
      const stockMap = new Map<string, number>();
      (stock || []).forEach((s) => stockMap.set(s.producto_id, Number(s.cantidad)));
      for (const it of productoItems) {
        const disp = stockMap.get(it.producto_id) || 0;
        if (Number(it.cantidad) > disp) {
          setWorking(false);
          toast.error(`Stock insuficiente para ${it.productos?.nombre} (necesita ${it.cantidad}, disp: ${disp})`);
          return;
        }
      }
    }

    const { data: venta, error } = await supabase.from("ventas").insert({
      tenant_id: tenant.id,
      cliente_id: cot.cliente_id,
      almacen_id: cot.almacen_id,
      user_id: user?.id,
      subtotal: cot.subtotal,
      impuesto: cot.impuesto,
      total: cot.total,
      notas: cot.notas ? `Cot. #${cot.numero}: ${cot.notas}` : `Generada desde cotización #${cot.numero}`,
    }).select().single();
    if (error || !venta) { setWorking(false); toast.error(error?.message || "Error"); return; }

    const itemsInsert = items.map((i: any) => ({
      venta_id: venta.id,
      producto_id: i.producto_id,
      servicio_id: i.servicio_id,
      descripcion: i.servicio_id ? (i.servicios?.nombre || i.descripcion) : null,
      cantidad: Number(i.cantidad),
      precio_unitario: Number(i.precio_unitario),
      impuesto_pct: Number(i.impuesto_pct),
      subtotal: Number(i.subtotal),
    }));
    const { error: e2 } = await (supabase as any).from("venta_items").insert(itemsInsert);
    if (e2) { setWorking(false); toast.error(e2.message); return; }

    const moves = productoItems.map((i: any) => ({
      tenant_id: tenant.id,
      producto_id: i.producto_id,
      almacen_id: cot.almacen_id,
      tipo: "venta" as const,
      cantidad: Number(i.cantidad),
      referencia: `Venta #${venta.numero} (Cot. #${cot.numero})`,
      user_id: user?.id,
    }));
    if (moves.length > 0) await supabase.from("stock_movements").insert(moves);

    await (supabase as any).from("cotizaciones")
      .update({ estado: "convertida", venta_id: venta.id })
      .eq("id", cot.id);

    setWorking(false);
    toast.success(`Convertida en venta #${venta.numero}`);
    navigate(`/ventas/${venta.id}`);
  };

  if (!cot) return <div className="text-muted-foreground">Cargando...</div>;
  if (cot.__notfound) return (
    <div className="space-y-3">
      <p className="text-muted-foreground">Cotización no encontrada.</p>
      <Button variant="outline" onClick={() => navigate("/cotizaciones")}>
        <ArrowLeft className="mr-2 h-4 w-4" />Volver al listado
      </Button>
    </div>
  );

  const vencida = cot.valida_hasta && new Date(cot.valida_hasta) < new Date()
    && !["aceptada", "convertida", "rechazada"].includes(cot.estado);
  const estado = vencida ? "vencida" : cot.estado;
  const yaConvertida = cot.estado === "convertida";

  return (
    <div className="mx-auto max-w-3xl">
      {dialog}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Button variant="ghost" onClick={() => navigate("/cotizaciones")}>
          <ArrowLeft className="mr-2 h-4 w-4" />Volver
        </Button>
        <div className="flex flex-wrap gap-2">
          {canManage && !yaConvertida && cot.estado === "borrador" && (
            <Button variant="outline" onClick={() => cambiarEstado("enviada")}>
              <Send className="mr-2 h-4 w-4" />Marcar enviada
            </Button>
          )}
          {canManage && !yaConvertida && cot.estado !== "rechazada" && (
            <>
              <Button variant="outline" onClick={() => cambiarEstado("aceptada")}>
                <Check className="mr-2 h-4 w-4" />Aceptada
              </Button>
              <Button variant="outline" onClick={() => cambiarEstado("rechazada")}>
                <X className="mr-2 h-4 w-4" />Rechazada
              </Button>
            </>
          )}
          {canManage && !yaConvertida && (
            <Button onClick={convertirAVenta} disabled={working}>
              <ShoppingCart className="mr-2 h-4 w-4" />{working ? "Convirtiendo..." : "Convertir a venta"}
            </Button>
          )}
          {yaConvertida && cot.venta_id && (
            <Button variant="outline" onClick={() => navigate(`/ventas/${cot.venta_id}`)}>
              <ShoppingCart className="mr-2 h-4 w-4" />Ver venta
            </Button>
          )}
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />Imprimir
          </Button>
        </div>
      </div>

      <Card className="shadow-card print:shadow-none">
        <CardContent className="p-8">
          <div className="mb-6 flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-semibold">{tenant?.nombre}</h2>
              <p className="text-sm text-muted-foreground">Cotización / Presupuesto</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Cotización</p>
              <p className="text-2xl font-mono font-semibold">#{cot.numero}</p>
              <Badge className="mt-1" variant={
                estado === "aceptada" || estado === "convertida" ? "default"
                : estado === "rechazada" || estado === "vencida" ? "destructive"
                : "secondary"
              }>{estado}</Badge>
            </div>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-4 border-y py-4 text-sm">
            <div>
              <p className="text-muted-foreground">Fecha</p>
              <p className="font-medium">{formatDateTime(cot.created_at)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Válida hasta</p>
              <p className="font-medium">{cot.valida_hasta ? new Date(cot.valida_hasta).toLocaleDateString() : "Sin vencimiento"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Almacén</p>
              <p className="font-medium">{cot.almacenes?.nombre}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Cliente</p>
              <p className="font-medium">{cot.clientes?.nombre || "Cliente ocasional"}</p>
              {cot.clientes?.identificador_fiscal && <p className="text-xs text-muted-foreground">ID: {cot.clientes.identificador_fiscal}</p>}
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Concepto</TableHead>
                <TableHead className="text-right">Cant.</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it) => (
                <TableRow key={it.id}>
                  <TableCell>
                    <div className="font-medium">
                      {it.productos?.nombre || it.servicios?.nombre || it.descripcion}
                    </div>
                    {it.productos?.sku && <div className="text-xs text-muted-foreground">{it.productos.sku}</div>}
                  </TableCell>
                  <TableCell className="text-right">{it.cantidad}</TableCell>
                  <TableCell className="text-right">{formatCurrency(it.precio_unitario, tenant?.moneda)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(it.subtotal, tenant?.moneda)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="mt-6 ml-auto w-64 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(cot.subtotal, tenant?.moneda)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Impuesto</span><span>{formatCurrency(cot.impuesto, tenant?.moneda)}</span></div>
            <div className="flex justify-between border-t pt-2 text-base font-semibold"><span>Total</span><span>{formatCurrency(cot.total, tenant?.moneda)}</span></div>
          </div>

          {cot.notas && (
            <div className="mt-6 border-t pt-4 text-sm">
              <p className="text-muted-foreground">Notas</p>
              <p>{cot.notas}</p>
            </div>
          )}

          <div className="mt-6 border-t pt-4 text-xs text-muted-foreground">
            Esta cotización no representa una venta ni afecta el inventario. Los precios y la disponibilidad están sujetos a confirmación al momento de la compra.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
