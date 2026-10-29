import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Printer, FileText, Pencil, Check, X } from "lucide-react";
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/format";
import { generarFactura } from "@/lib/facturas";
import { toast } from "sonner";

export default function VentaDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { tenant, user, canManage, isAdmin, isSuperadmin } = useAuth();
  const [venta, setVenta] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [factura, setFactura] = useState<any>(null);
  const [generando, setGenerando] = useState(false);
  const [editAtendido, setEditAtendido] = useState(false);
  const [nuevoAtendido, setNuevoAtendido] = useState("");
  const [savingAtendido, setSavingAtendido] = useState(false);

  const load = async () => {
    if (!id) return;
    const { data: v } = await supabase
      .from("ventas")
      .select("*, clientes(id, nombre, identificador_fiscal, email), almacenes(nombre)")
      .eq("id", id).maybeSingle();
    setVenta(v);
    const { data: it } = await supabase
      .from("venta_items")
      .select("*, productos(nombre, sku, unidad, impuesto_pct), servicios(nombre)")
      .eq("venta_id", id);
    setItems(it || []);
    const { data: f } = await supabase.from("facturas").select("id, numero_factura").eq("venta_id", id).maybeSingle();
    setFactura(f);
  };

  useEffect(() => { load(); }, [id]);

  const facturar = async () => {
    if (!venta || !tenant) return;
    setGenerando(true);
    try {
      const factId = await generarFactura({
        tenant_id: tenant.id,
        venta_id: venta.id,
        cliente_id: venta.cliente_id,
        user_id: user?.id,
        atendido_por_nombre: venta.atendido_por_nombre || null,
        condicion_pago: "contado",
        metodo_pago: "efectivo",
        notas: venta.notas,
        items: items.map((it) => ({
          producto_id: it.producto_id,
          codigo: it.productos?.sku,
          descripcion:
            it.productos?.nombre ||
            it.servicios?.nombre ||
            it.descripcion ||
            "Ítem",
          cantidad: Number(it.cantidad),
          unidad: it.productos?.unidad || (it.servicio_id ? "servicio" : undefined),
          precio_unitario: Number(it.precio_unitario),
          impuesto_pct: Number(it.impuesto_pct),
        })),
      });
      toast.success("Factura generada");
      navigate(`/facturas/${factId}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setGenerando(false);
    }
  };

  if (!venta) return <div className="text-muted-foreground">Cargando...</div>;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Button variant="ghost" onClick={() => navigate("/ventas")}>
          <ArrowLeft className="mr-2 h-4 w-4" />Volver
        </Button>
        <div className="flex gap-2">
          {factura ? (
            <Button variant="outline" onClick={() => navigate(`/facturas/${factura.id}`)}>
              <FileText className="mr-2 h-4 w-4" />Ver factura {factura.numero_factura}
            </Button>
          ) : canManage && (
            <Button variant="outline" onClick={facturar} disabled={generando}>
              <FileText className="mr-2 h-4 w-4" />{generando ? "Generando..." : "Facturar"}
            </Button>
          )}
          <Button onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />Imprimir
          </Button>
        </div>
      </div>

      <Card className="shadow-card print:shadow-none">
        <CardContent className="p-8">
          <div className="mb-6 flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-semibold">{tenant?.nombre}</h2>
              <p className="text-sm text-muted-foreground">Comprobante de venta</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Venta</p>
              <p className="text-2xl font-mono font-semibold">#{venta.numero}</p>
              <Badge variant={venta.estado === "completada" ? "default" : "secondary"} className="mt-1">{venta.estado}</Badge>
            </div>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-4 border-y py-4 text-sm">
            <div>
              <p className="text-muted-foreground">Fecha</p>
              <p className="font-medium">{formatDateTime(venta.created_at)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Almacén</p>
              <p className="font-medium">{venta.almacenes?.nombre}</p>
            </div>
            <div className="col-span-2">
              <p className="text-muted-foreground">Cliente</p>
              <p className="font-medium">{venta.clientes?.nombre || "Cliente ocasional"}</p>
              {venta.clientes?.identificador_fiscal && <p className="text-xs text-muted-foreground">ID: {venta.clientes.identificador_fiscal}</p>}
            </div>
            <div className="col-span-2">
              <p className="text-muted-foreground">Atendido por</p>
              {editAtendido ? (
                <div className="mt-1 flex items-center gap-2">
                  <Input
                    value={nuevoAtendido}
                    onChange={(e) => setNuevoAtendido(e.target.value)}
                    className="h-8 max-w-xs"
                    autoFocus
                  />
                  <Button
                    size="icon" variant="ghost" className="h-8 w-8"
                    disabled={savingAtendido}
                    onClick={async () => {
                      if (!nuevoAtendido.trim()) { toast.error("El nombre no puede estar vacío"); return; }
                      setSavingAtendido(true);
                      const { error } = await supabase.rpc("actualizar_atendido_venta", {
                        _venta_id: venta.id, _nombre: nuevoAtendido.trim(),
                      });
                      setSavingAtendido(false);
                      if (error) { toast.error(error.message); return; }
                      toast.success("Actualizado");
                      setEditAtendido(false);
                      load();
                    }}
                  ><Check className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditAtendido(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="mt-1 flex items-center gap-2">
                  <p className="font-medium">{venta.atendido_por_nombre || "—"}</p>
                  {(isAdmin || isSuperadmin) && (
                    <Button
                      size="icon" variant="ghost" className="h-7 w-7 print:hidden"
                      onClick={() => { setNuevoAtendido(venta.atendido_por_nombre || ""); setEditAtendido(true); }}
                      title="Editar (solo admin)"
                    ><Pencil className="h-3.5 w-3.5" /></Button>
                  )}
                </div>
              )}
              {(isAdmin || isSuperadmin) && venta.created_by_email && (
                <p className="text-xs text-muted-foreground print:hidden">
                  Cuenta: {venta.created_by_email}
                </p>
              )}
            </div>
          </div>


          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead className="text-right">Cant.</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it) => {
                const nombre =
                  it.productos?.nombre ||
                  it.servicios?.nombre ||
                  it.descripcion ||
                  "Ítem";
                const subtitulo = it.productos?.sku || (it.servicio_id ? "Servicio" : "");
                return (
                  <TableRow key={it.id}>
                    <TableCell>
                      <div className="font-medium">{nombre}</div>
                      {subtitulo && <div className="text-xs text-muted-foreground">{subtitulo}</div>}
                    </TableCell>
                    <TableCell className="text-right">{formatNumber(it.cantidad, 0)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(it.precio_unitario, tenant?.moneda)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(it.subtotal, tenant?.moneda)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <div className="mt-6 ml-auto w-64 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(venta.subtotal, tenant?.moneda)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Impuesto</span><span>{formatCurrency(venta.impuesto, tenant?.moneda)}</span></div>
            <div className="flex justify-between border-t pt-2 text-base font-semibold"><span>Total</span><span>{formatCurrency(venta.total, tenant?.moneda)}</span></div>
          </div>

          {venta.notas && (
            <div className="mt-6 border-t pt-4 text-sm">
              <p className="text-muted-foreground">Notas</p>
              <p>{venta.notas}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
