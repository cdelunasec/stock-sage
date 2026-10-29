import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAlmacen } from "@/contexts/AlmacenContext";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { NumberInput } from "@/components/ui/number-input";
import { Input } from "@/components/ui/input";
import { Plus, AlertTriangle, X } from "lucide-react";
import { toast } from "sonner";
import { formatNumber, formatDateTime } from "@/lib/format";

const tipoLabel: Record<string, string> = {
  entrada: "Entrada", salida: "Salida", ajuste: "Ajuste",
  transferencia: "Transferencia", venta: "Venta", devolucion: "Devolución",
};
const tipoVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  entrada: "default", devolucion: "default", salida: "destructive",
  venta: "destructive", ajuste: "secondary", transferencia: "outline",
};

const isUnitario = (u: string) => ["unidad", "caja", "pieza", "fardo", "docena", "paquete"].includes((u || "").toLowerCase());

export default function Stock() {
  const { tenant, canManage, user } = useAuth();
  const { almacenes, almacenActivo } = useAlmacen();
  const [productos, setProductos] = useState<any[]>([]);
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [stockRows, setStockRows] = useState<any[]>([]);
  const [movs, setMovs] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [porEmpaques, setPorEmpaques] = useState(false);
  const [fechaDesde, setFechaDesde] = useState<string>("");
  const [fechaHasta, setFechaHasta] = useState<string>("");
  const [form, setForm] = useState({
    producto_id: "", almacen_id: "", almacen_destino_id: "",
    tipo: "entrada", cantidad: 0, notas: "", proveedor_id: "",
  });

  const productoSel = productos.find((p) => p.id === form.producto_id);

  const load = async () => {
    if (!tenant) return;
    const { data: prod } = await supabase.from("productos")
      .select("id, nombre, sku, unidad, stock_minimo, unidad_empaque, unidades_por_empaque").order("nombre");
    setProductos(prod || []);
    const { data: provs } = await supabase.from("proveedores")
      .select("id, nombre").eq("activo", true).order("nombre");
    setProveedores(provs || []);
    const { data: stock } = await supabase
      .from("stock_levels")
      .select("cantidad, productos(id, nombre, sku, unidad, stock_minimo), almacenes(nombre)")
      .order("cantidad", { ascending: false });
    setStockRows(stock || []);
    let q = supabase
      .from("stock_movements")
      .select("*, productos(nombre, sku), almacenes!stock_movements_almacen_id_fkey(nombre), proveedores(nombre)")
      .order("created_at", { ascending: false });
    if (fechaDesde) q = q.gte("created_at", new Date(fechaDesde).toISOString());
    if (fechaHasta) {
      const hasta = new Date(fechaHasta);
      hasta.setHours(23, 59, 59, 999);
      q = q.lte("created_at", hasta.toISOString());
    }
    if (!fechaDesde && !fechaHasta) q = q.limit(50);
    const { data: mv } = await q;
    setMovs(mv || []);
  };
  useEffect(() => { load(); }, [tenant, fechaDesde, fechaHasta]);

  useEffect(() => {
    if (almacenActivo && !form.almacen_id) setForm((f) => ({ ...f, almacen_id: almacenActivo.id }));
  }, [almacenActivo]);

  const cantidadFinal = porEmpaques && productoSel?.unidades_por_empaque
    ? form.cantidad * Number(productoSel.unidades_por_empaque)
    : form.cantidad;

  const save = async () => {
    if (!form.producto_id || !form.almacen_id || !form.cantidad) {
      toast.error("Completa producto, almacén y cantidad"); return;
    }
    if (form.tipo === "transferencia" && !form.almacen_destino_id) {
      toast.error("Selecciona almacén destino"); return;
    }
    const payload: any = {
      tenant_id: tenant!.id,
      producto_id: form.producto_id,
      almacen_id: form.almacen_id,
      tipo: form.tipo,
      cantidad: cantidadFinal,
      notas: form.notas || (porEmpaques ? `Ingreso: ${form.cantidad} ${productoSel?.unidad_empaque || "empaque"} × ${productoSel?.unidades_por_empaque}` : null),
      user_id: user?.id,
    };
    if (form.tipo === "transferencia") payload.almacen_destino_id = form.almacen_destino_id;
    if (form.tipo === "entrada" && form.proveedor_id) payload.proveedor_id = form.proveedor_id;
    const { error } = await supabase.from("stock_movements").insert(payload);
    if (error) toast.error(error.message);
    else {
      toast.success("Movimiento registrado");
      setOpen(false);
      setPorEmpaques(false);
      setForm({ producto_id: "", almacen_id: almacenActivo?.id || "", almacen_destino_id: "", tipo: "entrada", cantidad: 0, notas: "", proveedor_id: "" });
      load();
    }
  };

  const puedeEmpaques = !!productoSel?.unidad_empaque && Number(productoSel?.unidades_por_empaque) > 1;
  const cantidadEntera = isUnitario(productoSel?.unidad || "");

  return (
    <>
      <PageHeader
        title="Stock"
        description="Niveles actuales y movimientos"
        actions={canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />Nuevo movimiento</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Nuevo movimiento de stock</DialogTitle></DialogHeader>
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="entrada">Entrada (compra)</SelectItem>
                      <SelectItem value="salida">Salida</SelectItem>
                      <SelectItem value="ajuste">Ajuste (puede ser negativo)</SelectItem>
                      <SelectItem value="transferencia">Transferencia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Producto</Label>
                  <Select value={form.producto_id} onValueChange={(v) => setForm({ ...form, producto_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                    <SelectContent>
                      {productos.map((p) => <SelectItem key={p.id} value={p.id}>{p.sku} — {p.nombre}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>{form.tipo === "transferencia" ? "Almacén origen" : "Almacén"}</Label>
                    <Select value={form.almacen_id} onValueChange={(v) => setForm({ ...form, almacen_id: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {almacenes.map((a) => <SelectItem key={a.id} value={a.id}>{a.nombre}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {form.tipo === "transferencia" && (
                    <div className="space-y-2">
                      <Label>Almacén destino</Label>
                      <Select value={form.almacen_destino_id} onValueChange={(v) => setForm({ ...form, almacen_destino_id: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {almacenes.filter((a) => a.id !== form.almacen_id).map((a) => (
                            <SelectItem key={a.id} value={a.id}>{a.nombre}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {form.tipo === "entrada" && (
                  <div className="space-y-2">
                    <Label>Proveedor (opcional)</Label>
                    <Select value={form.proveedor_id} onValueChange={(v) => setForm({ ...form, proveedor_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Sin proveedor" /></SelectTrigger>
                      <SelectContent>
                        {proveedores.map((p) => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {puedeEmpaques && (
                  <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3">
                    <Switch checked={porEmpaques} onCheckedChange={setPorEmpaques} />
                    <Label className="cursor-pointer">
                      Ingresar por empaques ({productoSel.unidad_empaque} × {productoSel.unidades_por_empaque} {productoSel.unidad})
                    </Label>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>
                    Cantidad {porEmpaques ? `(en ${productoSel?.unidad_empaque || "empaques"})` : `(en ${productoSel?.unidad || "unidades"})`}
                  </Label>
                  <NumberInput
                    integer={porEmpaques || cantidadEntera}
                    value={form.cantidad}
                    onChange={(v) => setForm({ ...form, cantidad: v })}
                  />
                  {porEmpaques && form.cantidad > 0 && (
                    <p className="text-xs text-muted-foreground">
                      = {cantidadFinal} {productoSel?.unidad} en stock
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Notas</Label>
                  <Textarea value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={save}>Registrar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      />

      <Tabs defaultValue="niveles">
        <TabsList>
          <TabsTrigger value="niveles">Niveles</TabsTrigger>
          <TabsTrigger value="movimientos">Movimientos</TabsTrigger>
        </TabsList>

        <TabsContent value="niveles" className="mt-4">
          <Card className="shadow-soft">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead>Almacén</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead className="text-right">Mínimo</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockRows.map((s, i) => {
                    const low = s.productos?.stock_minimo > 0 && Number(s.cantidad) <= Number(s.productos.stock_minimo);
                    return (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{s.productos?.nombre}</TableCell>
                        <TableCell>{s.almacenes?.nombre}</TableCell>
                        <TableCell className="text-right">{formatNumber(s.cantidad, 0)} {s.productos?.unidad}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{formatNumber(s.productos?.stock_minimo, 0)}</TableCell>
                        <TableCell>{low && <Badge variant="destructive"><AlertTriangle className="mr-1 h-3 w-3" />Bajo stock</Badge>}</TableCell>
                      </TableRow>
                    );
                  })}
                  {stockRows.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">Sin stock registrado</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="movimientos" className="mt-4 space-y-3">
          <Card className="shadow-soft">
            <CardContent className="flex flex-wrap items-end gap-3 p-4">
              <div className="space-y-1">
                <Label className="text-xs">Desde</Label>
                <Input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} className="w-[160px]" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Hasta</Label>
                <Input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} className="w-[160px]" />
              </div>
              {(fechaDesde || fechaHasta) && (
                <Button variant="ghost" size="sm" onClick={() => { setFechaDesde(""); setFechaHasta(""); }}>
                  <X className="mr-1 h-3 w-3" />Limpiar
                </Button>
              )}
              <p className="ml-auto text-xs text-muted-foreground">
                {fechaDesde || fechaHasta ? `${movs.length} movimientos en el rango` : `Últimos ${movs.length} movimientos`}
              </p>
            </CardContent>
          </Card>
          <Card className="shadow-soft">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead>Almacén</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead>Notas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movs.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="text-xs text-muted-foreground">{formatDateTime(m.created_at)}</TableCell>
                      <TableCell><Badge variant={tipoVariant[m.tipo]}>{tipoLabel[m.tipo]}</Badge></TableCell>
                      <TableCell>{m.productos?.nombre}</TableCell>
                      <TableCell>{m.almacenes?.nombre}</TableCell>
                      <TableCell className="text-sm">{m.proveedores?.nombre || "—"}</TableCell>
                      <TableCell className="text-right">{formatNumber(m.cantidad, 0)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{m.notas || "—"}</TableCell>
                    </TableRow>
                  ))}
                  {movs.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">Sin movimientos</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
