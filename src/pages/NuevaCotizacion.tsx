import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAlmacen } from "@/contexts/AlmacenContext";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { NumberInput } from "@/components/ui/number-input";
import { Plus, Trash2, Wrench, Package as PackageIcon, ScanBarcode } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";

type ItemTipo = "producto" | "servicio";
interface Item {
  tipo: ItemTipo;
  ref_id: string;
  nombre: string;
  unidad: string;
  cantidad: number;
  precio_unitario: number;
  impuesto_pct: number;
}

const OCASIONAL = "__ocasional";
const isUnitario = (u: string) => ["unidad", "caja", "pieza", "fardo", "docena", "paquete", "servicio"].includes((u || "").toLowerCase());

export default function NuevaCotizacion() {
  const navigate = useNavigate();
  const { tenant, user } = useAuth();
  const { almacenActivo } = useAlmacen();
  const [productos, setProductos] = useState<any[]>([]);
  const [servicios, setServicios] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [clienteId, setClienteId] = useState<string>(OCASIONAL);
  const [tipoSel, setTipoSel] = useState<ItemTipo>("producto");
  const [refSel, setRefSel] = useState<string>("");
  const [notas, setNotas] = useState("");
  const [validezDias, setValidezDias] = useState<number>(15);
  const [scanInput, setScanInput] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!tenant) return;
    (async () => {
      const { data: prod } = await supabase.from("productos").select("*").eq("activo", true).order("nombre");
      setProductos(prod || []);
      const { data: serv } = await (supabase as any).from("servicios").select("*").eq("activo", true).order("nombre");
      setServicios(serv || []);
      const { data: cli } = await supabase.from("clientes").select("id, nombre").order("nombre");
      setClientes(cli || []);
    })();
  }, [tenant]);

  const addItem = () => {
    if (!refSel) return;
    if (tipoSel === "producto") {
      const p = productos.find((x) => x.id === refSel); if (!p) return;
      if (items.find((i) => i.tipo === "producto" && i.ref_id === p.id)) { toast.error("Ya agregado"); return; }
      setItems([...items, {
        tipo: "producto", ref_id: p.id, nombre: p.nombre, unidad: p.unidad,
        cantidad: 1, precio_unitario: Number(p.precio_venta), impuesto_pct: Number(p.impuesto_pct),
      }]);
    } else {
      const s = servicios.find((x) => x.id === refSel); if (!s) return;
      if (items.find((i) => i.tipo === "servicio" && i.ref_id === s.id)) { toast.error("Ya agregado"); return; }
      setItems([...items, {
        tipo: "servicio", ref_id: s.id, nombre: s.nombre, unidad: "servicio",
        cantidad: 1, precio_unitario: Number(s.precio), impuesto_pct: Number(s.impuesto_pct),
      }]);
    }
    setRefSel("");
  };

  const addByCodigo = (codigo: string) => {
    const code = codigo.trim();
    if (!code) return;
    const p = productos.find(
      (x) => (x.codigo_barras && String(x.codigo_barras).trim() === code) || String(x.sku).trim() === code
    );
    if (!p) { toast.error(`Sin coincidencia para "${code}"`); return; }
    const idx = items.findIndex((i) => i.tipo === "producto" && i.ref_id === p.id);
    if (idx >= 0) {
      const next = [...items]; next[idx] = { ...next[idx], cantidad: next[idx].cantidad + 1 };
      setItems(next); toast.success(`+1 ${p.nombre}`); return;
    }
    setItems((prev) => [...prev, {
      tipo: "producto", ref_id: p.id, nombre: p.nombre, unidad: p.unidad,
      cantidad: 1, precio_unitario: Number(p.precio_venta), impuesto_pct: Number(p.impuesto_pct),
    }]);
    toast.success(`Agregado: ${p.nombre}`);
  };

  const updateItem = (idx: number, patch: Partial<Item>) => {
    const next = [...items]; next[idx] = { ...next[idx], ...patch }; setItems(next);
  };
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));

  const subtotal = items.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0);
  const impuesto = items.reduce((s, i) => s + i.cantidad * i.precio_unitario * (i.impuesto_pct / 100), 0);
  const total = subtotal + impuesto;

  const guardar = async () => {
    if (!almacenActivo) return;
    if (items.length === 0) { toast.error("Agrega al menos un concepto"); return; }
    setLoading(true);
    const cliente_id = clienteId === OCASIONAL ? null : clienteId;
    const valida_hasta = validezDias > 0
      ? new Date(Date.now() + validezDias * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const { data: cot, error } = await (supabase as any).from("cotizaciones").insert({
      tenant_id: tenant!.id,
      cliente_id,
      almacen_id: almacenActivo.id,
      user_id: user?.id,
      valida_hasta,
      subtotal, impuesto, total,
      estado: "borrador",
      notas: notas || null,
    }).select().single();
    if (error || !cot) { setLoading(false); toast.error(error?.message || "Error"); return; }

    const itemsInsert = items.map((i) => ({
      cotizacion_id: cot.id,
      producto_id: i.tipo === "producto" ? i.ref_id : null,
      servicio_id: i.tipo === "servicio" ? i.ref_id : null,
      descripcion: i.nombre,
      cantidad: i.cantidad,
      precio_unitario: i.precio_unitario,
      impuesto_pct: i.impuesto_pct,
      subtotal: i.cantidad * i.precio_unitario,
    }));
    const { error: e2 } = await (supabase as any).from("cotizacion_items").insert(itemsInsert);
    if (e2) { setLoading(false); toast.error(e2.message); return; }

    setLoading(false);
    toast.success(`Cotización #${cot.numero} creada`);
    navigate(`/cotizaciones/${cot.id}`);
  };

  if (!almacenActivo) {
    return <div className="text-muted-foreground">Selecciona un almacén en la barra superior.</div>;
  }

  const opciones = tipoSel === "producto" ? productos : servicios;

  return (
    <>
      <PageHeader title="Nueva cotización" description={`Almacén: ${almacenActivo.nombre}`} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="shadow-soft">
            <CardHeader><CardTitle className="text-base">Productos y servicios</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 rounded-md border border-dashed bg-muted/20 p-2">
                <ScanBarcode className="h-4 w-4 text-muted-foreground shrink-0" />
                <Input
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); addByCodigo(scanInput); setScanInput(""); }
                  }}
                  placeholder="Escanea o escribe código de barras / SKU"
                  className="h-8 border-0 bg-transparent shadow-none focus-visible:ring-0"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-md border bg-muted/30 p-0.5">
                  <Button type="button" size="sm" variant={tipoSel === "producto" ? "default" : "ghost"} onClick={() => { setTipoSel("producto"); setRefSel(""); }}>
                    <PackageIcon className="mr-1.5 h-3.5 w-3.5" />Producto
                  </Button>
                  <Button type="button" size="sm" variant={tipoSel === "servicio" ? "default" : "ghost"} onClick={() => { setTipoSel("servicio"); setRefSel(""); }}>
                    <Wrench className="mr-1.5 h-3.5 w-3.5" />Servicio
                  </Button>
                </div>
                <div className="flex flex-1 gap-2 min-w-[240px]">
                  <Select value={refSel} onValueChange={setRefSel}>
                    <SelectTrigger>
                      <SelectValue placeholder={tipoSel === "producto" ? "Selecciona producto" : "Selecciona servicio"} />
                    </SelectTrigger>
                    <SelectContent>
                      {opciones.length === 0 && (
                        <div className="px-2 py-3 text-sm text-muted-foreground">
                          {tipoSel === "producto" ? "Sin productos" : "Sin servicios"}
                        </div>
                      )}
                      {tipoSel === "producto"
                        ? productos.map((p) => <SelectItem key={p.id} value={p.id}>{p.sku} — {p.nombre}</SelectItem>)
                        : servicios.map((s) => <SelectItem key={s.id} value={s.id}>{s.nombre} — {formatCurrency(s.precio, tenant?.moneda)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button onClick={addItem}><Plus className="h-4 w-4" /></Button>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Concepto</TableHead>
                    <TableHead className="w-32">Cantidad</TableHead>
                    <TableHead className="w-32">Precio</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((it, i) => (
                    <TableRow key={`${it.tipo}-${it.ref_id}`}>
                      <TableCell>
                        <div className="flex items-center gap-1.5 font-medium">
                          {it.tipo === "servicio" ? <Wrench className="h-3.5 w-3.5 text-primary" /> : <PackageIcon className="h-3.5 w-3.5 text-muted-foreground" />}
                          {it.nombre}
                        </div>
                      </TableCell>
                      <TableCell>
                        <NumberInput integer={isUnitario(it.unidad)} value={it.cantidad}
                          onChange={(v) => updateItem(i, { cantidad: v })} className="h-8" />
                      </TableCell>
                      <TableCell>
                        <NumberInput value={it.precio_unitario}
                          onChange={(v) => updateItem(i, { precio_unitario: v })} className="h-8" />
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(it.cantidad * it.precio_unitario, tenant?.moneda)}</TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" onClick={() => removeItem(i)}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {items.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">Sin conceptos</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="shadow-soft">
            <CardHeader><CardTitle className="text-base">Detalles</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Cliente</Label>
                <Select value={clienteId} onValueChange={setClienteId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={OCASIONAL}>Cliente ocasional</SelectItem>
                    {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Validez (días)</Label>
                <NumberInput integer value={validezDias} min={0} onChange={(v) => setValidezDias(v)} />
                <p className="text-xs text-muted-foreground">0 = sin fecha de vencimiento</p>
              </div>
              <div className="space-y-2">
                <Label>Notas</Label>
                <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={3} />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardContent className="space-y-2 p-5">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(subtotal, tenant?.moneda)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Impuesto</span><span>{formatCurrency(impuesto, tenant?.moneda)}</span></div>
              <div className="mt-2 flex justify-between border-t pt-3 text-lg font-semibold">
                <span>Total</span><span>{formatCurrency(total, tenant?.moneda)}</span>
              </div>
              <Button className="mt-3 w-full" onClick={guardar} disabled={loading || items.length === 0}>
                {loading ? "Guardando..." : "Guardar cotización"}
              </Button>
              <Button variant="outline" className="w-full" onClick={() => navigate("/cotizaciones")}>Cancelar</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
