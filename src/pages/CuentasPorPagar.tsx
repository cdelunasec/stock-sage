import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { NumberInput } from "@/components/ui/number-input";
import { Plus, DollarSign, AlertCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";

export default function CuentasPorPagar() {
  const { tenant, user } = useAuth();
  const [oc, setOC] = useState<any[]>([]);
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // OC dialog
  const [openOC, setOpenOC] = useState(false);
  const [fOC, setFOC] = useState({
    proveedor_id: "", fecha: new Date().toISOString().slice(0,10),
    fecha_vencimiento: "", condicion: "credito", total: 0, impuesto: 0,
    notas: "", ncf: "", descripcion: "Compra de mercadería",
  });

  // Pago dialog
  const [pago, setPago] = useState<{ orden: any; monto: number; metodo: string; fecha: string; notas: string } | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: o }, { data: p }] = await Promise.all([
      (supabase as any).from("ordenes_compra")
        .select("*, proveedores:proveedor_id(nombre)")
        .order("fecha", { ascending: false }),
      supabase.from("proveedores").select("id, nombre").order("nombre"),
    ]);
    setOC(o || []); setProveedores(p || []); setLoading(false);
  };
  useEffect(() => { if (tenant) load(); }, [tenant]);

  const totales = useMemo(() => {
    const pendiente = oc.filter((o) => o.estado !== "pagada" && o.estado !== "anulada");
    const total = pendiente.reduce((s, o) => s + Number(o.saldo), 0);
    const today = new Date().toISOString().slice(0,10);
    const vencidas = pendiente.filter((o) => o.fecha_vencimiento && o.fecha_vencimiento < today);
    const proximas = pendiente.filter((o) => {
      if (!o.fecha_vencimiento) return false;
      const d = new Date(o.fecha_vencimiento); const diff = (d.getTime() - Date.now()) / 86400000;
      return diff >= 0 && diff <= 7;
    });
    return { total, vencidas: vencidas.length, proximas: proximas.length, count: pendiente.length };
  }, [oc]);

  const crearOC = async () => {
    if (!fOC.proveedor_id || fOC.total <= 0) { toast.error("Proveedor y total requeridos"); return; }
    const subtotal = fOC.total - fOC.impuesto;
    const { data: orden, error } = await (supabase as any).from("ordenes_compra").insert({
      tenant_id: tenant!.id,
      proveedor_id: fOC.proveedor_id,
      fecha: fOC.fecha,
      fecha_vencimiento: fOC.fecha_vencimiento || null,
      condicion_pago: fOC.condicion,
      subtotal, impuesto: fOC.impuesto, total: fOC.total,
      saldo: fOC.condicion === "contado" ? 0 : fOC.total,
      estado: fOC.condicion === "contado" ? "pagada" : "recibida",
      notas: fOC.notas || null,
      ncf: fOC.ncf || null,
      user_id: user?.id,
    }).select().single();
    if (error) { toast.error(error.message); return; }

    await (supabase as any).from("orden_compra_items").insert({
      orden_id: orden.id,
      descripcion: fOC.descripcion,
      cantidad: 1,
      precio_unitario: subtotal,
      impuesto_pct: 0,
      subtotal,
    });

    toast.success(`Orden #${orden.numero} creada`);
    setOpenOC(false);
    setFOC({ proveedor_id: "", fecha: new Date().toISOString().slice(0,10), fecha_vencimiento: "", condicion: "credito", total: 0, impuesto: 0, notas: "", ncf: "", descripcion: "Compra de mercadería" });
    load();
  };

  const registrarPago = async () => {
    if (!pago) return;
    const { error } = await (supabase as any).rpc("registrar_pago_proveedor", {
      _orden_id: pago.orden.id,
      _monto: pago.monto,
      _metodo: pago.metodo || null,
      _fecha: pago.fecha,
      _notas: pago.notas || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Pago registrado"); setPago(null); load();
  };

  const eliminar = async (id: string) => {
    const { error } = await (supabase as any).from("ordenes_compra").update({ estado: "anulada" }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Orden anulada"); load();
  };

  const today = new Date().toISOString().slice(0,10);

  return (
    <>
      <PageHeader title="Cuentas por Pagar" description="Órdenes de compra y pagos a proveedores" />

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card className="shadow-soft"><CardContent className="p-5">
          <p className="text-sm text-muted-foreground">Saldo pendiente</p>
          <p className="text-2xl font-semibold mt-1">{formatCurrency(totales.total, tenant?.moneda)}</p>
          <p className="text-xs text-muted-foreground mt-1">{totales.count} órdenes</p>
        </CardContent></Card>
        <Card className={`shadow-soft ${totales.vencidas ? "border-destructive" : ""}`}><CardContent className="p-5">
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            {totales.vencidas > 0 && <AlertCircle className="h-3.5 w-3.5 text-destructive" />}Vencidas
          </p>
          <p className="text-2xl font-semibold mt-1">{totales.vencidas}</p>
        </CardContent></Card>
        <Card className="shadow-soft"><CardContent className="p-5">
          <p className="text-sm text-muted-foreground">Próximas 7 días</p>
          <p className="text-2xl font-semibold mt-1">{totales.proximas}</p>
        </CardContent></Card>
      </div>

      <Card className="shadow-soft">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Órdenes de compra</CardTitle>
          <Button onClick={() => setOpenOC(true)}><Plus className="h-4 w-4 mr-1" />Nueva orden</Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>#</TableHead><TableHead>Fecha</TableHead><TableHead>Proveedor</TableHead>
              <TableHead>Vence</TableHead><TableHead>Condición</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              <TableHead>Estado</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={9} className="text-center py-6 text-muted-foreground">Cargando…</TableCell></TableRow>}
              {!loading && oc.length === 0 && <TableRow><TableCell colSpan={9} className="text-center py-6 text-muted-foreground">Sin órdenes</TableCell></TableRow>}
              {oc.map((o) => {
                const venc = o.fecha_vencimiento && o.fecha_vencimiento < today && o.estado !== "pagada" && o.estado !== "anulada";
                return (
                  <TableRow key={o.id} className={venc ? "bg-destructive/5" : ""}>
                    <TableCell>#{o.numero}</TableCell>
                    <TableCell>{o.fecha}</TableCell>
                    <TableCell className="font-medium">{o.proveedores?.nombre || "—"}</TableCell>
                    <TableCell>{o.fecha_vencimiento || "—"}{venc && <Badge variant="destructive" className="ml-2 text-[10px]">vencida</Badge>}</TableCell>
                    <TableCell className="capitalize">{o.condicion_pago}</TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(o.total), tenant?.moneda)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(Number(o.saldo), tenant?.moneda)}</TableCell>
                    <TableCell><Badge variant={o.estado === "pagada" ? "default" : o.estado === "anulada" ? "destructive" : "secondary"}>{o.estado}</Badge></TableCell>
                    <TableCell className="text-right">
                      {o.estado !== "pagada" && o.estado !== "anulada" && (
                        <Button size="icon" variant="ghost" title="Registrar pago" onClick={() => setPago({ orden: o, monto: Number(o.saldo), metodo: "transferencia", fecha: today, notas: "" })}>
                          <DollarSign className="h-4 w-4" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" onClick={() => eliminar(o.id)}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={openOC} onOpenChange={setOpenOC}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nueva orden de compra</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label>Proveedor *</Label>
              <Select value={fOC.proveedor_id} onValueChange={(v) => setFOC({ ...fOC, proveedor_id: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>{proveedores.map((p) => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Descripción</Label><Input value={fOC.descripcion} onChange={(e) => setFOC({ ...fOC, descripcion: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Fecha</Label><Input type="date" value={fOC.fecha} onChange={(e) => setFOC({ ...fOC, fecha: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Vencimiento</Label><Input type="date" value={fOC.fecha_vencimiento} onChange={(e) => setFOC({ ...fOC, fecha_vencimiento: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Condición</Label>
                <Select value={fOC.condicion} onValueChange={(v) => setFOC({ ...fOC, condicion: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contado">Contado</SelectItem>
                    <SelectItem value="credito">Crédito</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>NCF (opcional)</Label><Input value={fOC.ncf} onChange={(e) => setFOC({ ...fOC, ncf: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Total</Label><NumberInput value={fOC.total} onChange={(v) => setFOC({ ...fOC, total: v })} /></div>
              <div className="space-y-1.5"><Label>ITBIS incluido</Label><NumberInput value={fOC.impuesto} onChange={(v) => setFOC({ ...fOC, impuesto: v })} /></div>
            </div>
            <div className="space-y-1.5"><Label>Notas</Label><Textarea rows={2} value={fOC.notas} onChange={(e) => setFOC({ ...fOC, notas: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenOC(false)}>Cancelar</Button>
            <Button onClick={crearOC}>Crear</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pago} onOpenChange={(o) => !o && setPago(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar pago — Orden #{pago?.orden.numero}</DialogTitle></DialogHeader>
          {pago && (
            <div className="grid gap-3">
              <p className="text-sm text-muted-foreground">Saldo actual: <strong>{formatCurrency(Number(pago.orden.saldo), tenant?.moneda)}</strong></p>
              <div className="space-y-1.5"><Label>Monto</Label><NumberInput value={pago.monto} onChange={(v) => setPago({ ...pago, monto: v })} /></div>
              <div className="space-y-1.5"><Label>Fecha</Label><Input type="date" value={pago.fecha} onChange={(e) => setPago({ ...pago, fecha: e.target.value })} /></div>
              <div className="space-y-1.5">
                <Label>Método</Label>
                <Select value={pago.metodo} onValueChange={(v) => setPago({ ...pago, metodo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="efectivo">Efectivo</SelectItem>
                    <SelectItem value="transferencia">Transferencia</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                    <SelectItem value="tarjeta">Tarjeta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Notas</Label><Textarea rows={2} value={pago.notas} onChange={(e) => setPago({ ...pago, notas: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPago(null)}>Cancelar</Button>
            <Button onClick={registrarPago}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
