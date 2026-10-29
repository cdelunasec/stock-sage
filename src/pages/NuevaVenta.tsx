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
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { NumberInput } from "@/components/ui/number-input";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Trash2, UserPlus, Wrench, Package as PackageIcon, ScanBarcode } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";
import { generarFactura } from "@/lib/facturas";
import { logAudit } from "@/lib/audit";

type ItemTipo = "producto" | "servicio";

interface Item {
  tipo: ItemTipo;
  ref_id: string;
  sku: string;
  nombre: string;
  unidad: string;
  cantidad: number;
  precio_original: number;       // precio de lista
  precio_unitario: number;       // precio final aplicado
  descuento_motivo: string;
  impuesto_pct: number;
  stock_disponible: number;
  por_empaque: boolean;
  unidad_empaque: string | null;
  unidades_por_empaque: number;
  permite_venta_empaque: boolean;
}

const isUnitario = (u: string) => ["unidad", "caja", "pieza", "fardo", "docena", "paquete"].includes((u || "").toLowerCase());
const OCASIONAL = "__ocasional";

export default function NuevaVenta() {
  const navigate = useNavigate();
  const { tenant, user } = useAuth();
  const { almacenActivo } = useAlmacen();
  const [productos, setProductos] = useState<any[]>([]);
  const [servicios, setServicios] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [stockMap, setStockMap] = useState<Map<string, number>>(new Map());
  const [items, setItems] = useState<Item[]>([]);
  const [clienteId, setClienteId] = useState<string>(OCASIONAL);
  const [tipoSel, setTipoSel] = useState<ItemTipo>("producto");
  const [refSel, setRefSel] = useState<string>("");
  const [notas, setNotas] = useState("");
  const [atendidoPor, setAtendidoPor] = useState("");
  const [generarFacturaToggle, setGenerarFacturaToggle] = useState(false);
  const [condicionPago, setCondicionPago] = useState<"contado" | "credito">("contado");
  const [metodoPago, setMetodoPago] = useState<string>("efectivo");
  const [ncfTipo, setNcfTipo] = useState<string>("none");
  const [loading, setLoading] = useState(false);
  const [scanInput, setScanInput] = useState("");

  // Crear cliente al vuelo
  const [clienteOpen, setClienteOpen] = useState(false);
  const [nuevoCliente, setNuevoCliente] = useState({
    nombre: "", email: "", telefono: "", identificador_fiscal: "",
  });

  const cargarClientes = async () => {
    const { data: cli } = await supabase.from("clientes").select("id, nombre").order("nombre");
    setClientes(cli || []);
  };

  useEffect(() => {
    if (!tenant || !almacenActivo) return;
    (async () => {
      const { data: prod } = await supabase.from("productos").select("*").eq("activo", true).order("nombre");
      setProductos(prod || []);
      const { data: serv } = await (supabase as any).from("servicios").select("*").eq("activo", true).order("nombre");
      setServicios(serv || []);
      await cargarClientes();
      const { data: stock } = await supabase
        .from("stock_levels").select("producto_id, cantidad").eq("almacen_id", almacenActivo.id);
      const m = new Map<string, number>();
      (stock || []).forEach((s) => m.set(s.producto_id, Number(s.cantidad)));
      setStockMap(m);
      // Precargar "Atendido por" con el nombre del usuario autenticado
      if (user?.id) {
        const { data: prof } = await supabase
          .from("profiles").select("nombre_completo, email").eq("id", user.id).maybeSingle();
        setAtendidoPor(prof?.nombre_completo || prof?.email || user.email || "");
      }
    })();
  }, [tenant, almacenActivo, user?.id]);

  const addItem = () => {
    if (!refSel) return;
    if (tipoSel === "producto") {
      const p = productos.find((x) => x.id === refSel); if (!p) return;
      if (items.find((i) => i.tipo === "producto" && i.ref_id === p.id)) { toast.error("Ya agregado"); return; }
      setItems([...items, {
        tipo: "producto", ref_id: p.id,
        sku: p.sku, nombre: p.nombre, unidad: p.unidad,
        cantidad: 1,
        precio_original: Number(p.precio_venta),
        precio_unitario: Number(p.precio_venta),
        descuento_motivo: "",
        impuesto_pct: Number(p.impuesto_pct),
        stock_disponible: stockMap.get(p.id) || 0,
        por_empaque: false,
        unidad_empaque: p.unidad_empaque,
        unidades_por_empaque: Number(p.unidades_por_empaque) || 1,
        permite_venta_empaque: !!p.permite_venta_empaque,
      }]);
    } else {
      const s = servicios.find((x) => x.id === refSel); if (!s) return;
      if (items.find((i) => i.tipo === "servicio" && i.ref_id === s.id)) { toast.error("Ya agregado"); return; }
      setItems([...items, {
        tipo: "servicio", ref_id: s.id,
        sku: "", nombre: s.nombre, unidad: "servicio",
        cantidad: 1,
        precio_original: Number(s.precio),
        precio_unitario: Number(s.precio),
        descuento_motivo: "",
        impuesto_pct: Number(s.impuesto_pct),
        stock_disponible: 0,
        por_empaque: false, unidad_empaque: null, unidades_por_empaque: 1, permite_venta_empaque: false,
      }]);
    }
    setRefSel("");
  };

  const updateItem = (idx: number, patch: Partial<Item>) => {
    const next = [...items]; next[idx] = { ...next[idx], ...patch }; setItems(next);
  };
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));

  const addProductoByCodigo = (codigo: string) => {
    const code = codigo.trim();
    if (!code) return;
    const p = productos.find(
      (x) => (x.codigo_barras && String(x.codigo_barras).trim() === code) || String(x.sku).trim() === code
    );
    if (!p) {
      toast.error(`Sin coincidencia para "${code}"`);
      return;
    }
    const existingIdx = items.findIndex((i) => i.tipo === "producto" && i.ref_id === p.id);
    if (existingIdx >= 0) {
      const next = [...items];
      const it = next[existingIdx];
      const nuevaCant = it.cantidad + 1;
      const reales = it.por_empaque ? nuevaCant * it.unidades_por_empaque : nuevaCant;
      if (reales > it.stock_disponible) {
        toast.error(`Stock insuficiente para ${it.nombre}`);
        return;
      }
      next[existingIdx] = { ...it, cantidad: nuevaCant };
      setItems(next);
      toast.success(`+1 ${p.nombre}`);
      return;
    }
    const stock = stockMap.get(p.id) || 0;
    if (stock < 1) {
      toast.error(`Sin stock de ${p.nombre}`);
      return;
    }
    setItems((prev) => [...prev, {
      tipo: "producto", ref_id: p.id,
      sku: p.sku, nombre: p.nombre, unidad: p.unidad,
      cantidad: 1,
      precio_original: Number(p.precio_venta),
      precio_unitario: Number(p.precio_venta),
      descuento_motivo: "",
      impuesto_pct: Number(p.impuesto_pct),
      stock_disponible: stock,
      por_empaque: false,
      unidad_empaque: p.unidad_empaque,
      unidades_por_empaque: Number(p.unidades_por_empaque) || 1,
      permite_venta_empaque: !!p.permite_venta_empaque,
    }]);
    toast.success(`Agregado: ${p.nombre}`);
  };


  const unidadesReales = (it: Item) => it.por_empaque ? it.cantidad * it.unidades_por_empaque : it.cantidad;
  const lineSubtotal = (it: Item) => unidadesReales(it) * it.precio_unitario;

  const subtotal = items.reduce((s, i) => s + lineSubtotal(i), 0);
  const impuesto = items.reduce((s, i) => s + lineSubtotal(i) * (i.impuesto_pct / 100), 0);
  const total = subtotal + impuesto;

  const guardarCliente = async () => {
    if (!nuevoCliente.nombre.trim()) { toast.error("Nombre obligatorio"); return; }
    const { data, error } = await supabase.from("clientes").insert({
      tenant_id: tenant!.id,
      nombre: nuevoCliente.nombre.trim(),
      email: nuevoCliente.email || null,
      telefono: nuevoCliente.telefono || null,
      identificador_fiscal: nuevoCliente.identificador_fiscal || null,
    }).select("id, nombre").single();
    if (error || !data) { toast.error(error?.message || "Error"); return; }
    toast.success("Cliente creado");
    await cargarClientes();
    setClienteId(data.id);
    setClienteOpen(false);
    setNuevoCliente({ nombre: "", email: "", telefono: "", identificador_fiscal: "" });
  };

  const guardar = async () => {
    if (!almacenActivo) return;
    if (items.length === 0) { toast.error("Agrega al menos un producto o servicio"); return; }
    for (const it of items) {
      if (it.precio_unitario > it.precio_original) {
        toast.error(`No puedes vender ${it.nombre} por encima del precio de lista`); return;
      }
      if (it.precio_unitario < it.precio_original && !it.descuento_motivo.trim()) {
        toast.error(`Indica el motivo del descuento para ${it.nombre}`); return;
      }
      if (it.tipo !== "producto") continue;
      const reales = unidadesReales(it);
      if (reales > it.stock_disponible) {
        toast.error(`Stock insuficiente para ${it.nombre} (necesita ${reales}, disp: ${it.stock_disponible})`); return;
      }
    }
    setLoading(true);
    const cliente_id = clienteId === OCASIONAL ? null : clienteId;
    const { data: venta, error } = await supabase.from("ventas").insert({
      tenant_id: tenant!.id,
      cliente_id,
      almacen_id: almacenActivo.id,
      user_id: user?.id,
      atendido_por_nombre: atendidoPor.trim() || null,
      subtotal, impuesto, total,
      notas: notas || null,
    }).select().single();

    if (error || !venta) { setLoading(false); toast.error(error?.message || "Error"); return; }

    await logAudit("venta_creada", "venta", venta.id, {
      numero: venta.numero, total, items: items.length, atendido_por: atendidoPor.trim() || null,
    });

    const itemsInsert = items.map((i) => {
      const descPct = i.precio_original > 0 ? Math.max(0, ((i.precio_original - i.precio_unitario) / i.precio_original) * 100) : 0;
      return {
        venta_id: venta.id,
        producto_id: i.tipo === "producto" ? i.ref_id : null,
        servicio_id: i.tipo === "servicio" ? i.ref_id : null,
        descripcion: i.tipo === "servicio" ? i.nombre : null,
        cantidad: unidadesReales(i),
        precio_unitario: i.precio_unitario,
        precio_original: i.precio_original,
        descuento_pct: descPct,
        descuento_motivo: descPct > 0 ? i.descuento_motivo : null,
        impuesto_pct: i.impuesto_pct,
        subtotal: lineSubtotal(i),
      };
    });
    const { error: e2 } = await (supabase as any).from("venta_items").insert(itemsInsert);
    if (e2) { setLoading(false); toast.error(e2.message); return; }

    // Movimientos de stock solo para productos
    const moves = items.filter((i) => i.tipo === "producto").map((i) => ({
      tenant_id: tenant!.id,
      producto_id: i.ref_id,
      almacen_id: almacenActivo.id,
      tipo: "venta" as const,
      cantidad: unidadesReales(i),
      referencia: `Venta #${venta.numero}`,
      user_id: user?.id,
    }));
    if (moves.length > 0) {
      await supabase.from("stock_movements").insert(moves);
    }

    if (generarFacturaToggle) {
      try {
        const factId = await generarFactura({
          tenant_id: tenant!.id,
          venta_id: venta.id,
          cliente_id,
          user_id: user?.id,
          atendido_por_nombre: atendidoPor.trim() || null,
          condicion_pago: condicionPago,
          metodo_pago: metodoPago,
          ncf_tipo: ncfTipo === "none" ? null : (ncfTipo as any),
          notas: notas || null,
          items: items.map((i) => ({
            producto_id: i.tipo === "producto" ? i.ref_id : null,
            codigo: i.tipo === "producto" ? i.sku : null,
            descripcion: i.nombre,
            cantidad: unidadesReales(i),
            unidad: i.unidad,
            precio_unitario: i.precio_unitario,
            precio_original: i.precio_original,
            descuento_motivo: i.precio_unitario < i.precio_original ? i.descuento_motivo : null,
            impuesto_pct: i.impuesto_pct,
            presentacion: i.por_empaque
              ? `${i.cantidad} ${i.unidad_empaque} (${unidadesReales(i)} ${i.unidad})`
              : null,
          })),
        });
        setLoading(false);
        toast.success(`Venta #${venta.numero} y factura generadas`);
        navigate(`/facturas/${factId}`);
        return;
      } catch (e: any) {
        toast.error("Venta registrada pero falló la factura: " + e.message);
      }
    }

    setLoading(false);
    toast.success(`Venta #${venta.numero} registrada`);
    navigate(`/ventas/${venta.id}`);
  };

  if (!almacenActivo) {
    return <div className="text-muted-foreground">Selecciona un almacén en la barra superior.</div>;
  }

  const opciones = tipoSel === "producto" ? productos : servicios;

  return (
    <>
      <PageHeader title="Nueva venta" description={`Almacén: ${almacenActivo.nombre}`} />

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
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addProductoByCodigo(scanInput);
                      setScanInput("");
                    }
                  }}
                  placeholder="Escanea o escribe código de barras / SKU y presiona Enter"
                  className="h-8 border-0 bg-transparent shadow-none focus-visible:ring-0"
                  autoFocus
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-md border bg-muted/30 p-0.5">
                  <Button
                    type="button"
                    size="sm"
                    variant={tipoSel === "producto" ? "default" : "ghost"}
                    onClick={() => { setTipoSel("producto"); setRefSel(""); }}
                  >
                    <PackageIcon className="mr-1.5 h-3.5 w-3.5" />Producto
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={tipoSel === "servicio" ? "default" : "ghost"}
                    onClick={() => { setTipoSel("servicio"); setRefSel(""); }}
                  >
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
                          {tipoSel === "producto" ? "Sin productos" : "Sin servicios. Crea uno en Servicios."}
                        </div>
                      )}
                      {tipoSel === "producto"
                        ? productos.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.sku} — {p.nombre} ({stockMap.get(p.id) || 0} disp.)
                          </SelectItem>
                        ))
                        : servicios.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.nombre} — {formatCurrency(s.precio, tenant?.moneda)}
                          </SelectItem>
                        ))}
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
                  {items.map((it, i) => {
                    const cantidadEntera = it.por_empaque || isUnitario(it.unidad);
                    return (
                      <TableRow key={`${it.tipo}-${it.ref_id}`}>
                        <TableCell>
                          <div className="flex items-center gap-1.5 font-medium">
                            {it.tipo === "servicio"
                              ? <Wrench className="h-3.5 w-3.5 text-primary" />
                              : <PackageIcon className="h-3.5 w-3.5 text-muted-foreground" />}
                            {it.nombre}
                          </div>
                          {it.tipo === "producto" && (
                            <div className="text-xs text-muted-foreground">Disp: {it.stock_disponible} {it.unidad}</div>
                          )}
                          {it.permite_venta_empaque && it.unidad_empaque && (
                            <label className="mt-1 flex items-center gap-1.5 text-xs">
                              <Switch checked={it.por_empaque} onCheckedChange={(v) => updateItem(i, { por_empaque: v, cantidad: 1 })} />
                              <span>Por {it.unidad_empaque} (×{it.unidades_por_empaque})</span>
                            </label>
                          )}
                        </TableCell>
                        <TableCell>
                          <NumberInput
                            integer={cantidadEntera}
                            value={it.cantidad}
                            onChange={(v) => updateItem(i, { cantidad: v })}
                            className="h-8"
                          />
                          {it.por_empaque && (
                            <div className="mt-1 text-xs text-muted-foreground">= {unidadesReales(it)} {it.unidad}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <NumberInput
                            value={it.precio_unitario}
                            max={it.precio_original}
                            onChange={(v) => updateItem(i, { precio_unitario: Math.min(v, it.precio_original) })}
                            className="h-8"
                          />
                          {it.precio_unitario < it.precio_original && (
                            <>
                              <div className="mt-1 text-xs text-success">
                                −{(((it.precio_original - it.precio_unitario) / it.precio_original) * 100).toFixed(1)}%
                                {" "}({formatCurrency(it.precio_original - it.precio_unitario, tenant?.moneda)})
                                <div className="text-muted-foreground line-through">{formatCurrency(it.precio_original, tenant?.moneda)}</div>
                              </div>
                              <Input
                                placeholder="Motivo descuento *"
                                value={it.descuento_motivo}
                                onChange={(e) => updateItem(i, { descuento_motivo: e.target.value })}
                                className="mt-1 h-7 text-xs"
                              />
                            </>
                          )}
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(lineSubtotal(it), tenant?.moneda)}</TableCell>
                        <TableCell>
                          <Button size="icon" variant="ghost" onClick={() => removeItem(i)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
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
                <div className="flex gap-2">
                  <Select value={clienteId} onValueChange={setClienteId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={OCASIONAL}>Cliente ocasional</SelectItem>
                      {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="outline" size="icon" onClick={() => setClienteOpen(true)} title="Nuevo cliente">
                    <UserPlus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Atendido por</Label>
                <Input
                  value={atendidoPor}
                  onChange={(e) => setAtendidoPor(e.target.value)}
                  placeholder="Nombre visible en factura"
                />
                <p className="text-xs text-muted-foreground">
                  Aparecerá en la factura. Tu cuenta queda registrada internamente.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Notas</Label>
                <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={3} />
              </div>

              <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <Switch checked={generarFacturaToggle} onCheckedChange={setGenerarFacturaToggle} />
                  <Label className="cursor-pointer">Generar factura ahora</Label>
                </div>
                {generarFacturaToggle && (
                  <>
                    <div className="space-y-2">
                      <Label>Condición</Label>
                      <Select value={condicionPago} onValueChange={(v) => setCondicionPago(v as any)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="contado">Contado</SelectItem>
                          <SelectItem value="credito">Crédito</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Método de pago</Label>
                      <Select value={metodoPago} onValueChange={setMetodoPago}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="efectivo">Efectivo</SelectItem>
                          <SelectItem value="tarjeta">Tarjeta</SelectItem>
                          <SelectItem value="transferencia">Transferencia</SelectItem>
                          <SelectItem value="cheque">Cheque</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Tipo NCF (DGII)</Label>
                      <Select value={ncfTipo} onValueChange={setNcfTipo}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sin NCF</SelectItem>
                          <SelectItem value="B01">B01 - Crédito fiscal</SelectItem>
                          <SelectItem value="B02">B02 - Consumidor final</SelectItem>
                          <SelectItem value="B14">B14 - Régimen especial</SelectItem>
                          <SelectItem value="B15">B15 - Gubernamental</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
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
                {loading ? "Guardando..." : "Registrar venta"}
              </Button>
              <Button variant="outline" className="w-full" onClick={() => navigate("/ventas")}>Cancelar</Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialog crear cliente */}
      <Dialog open={clienteOpen} onOpenChange={setClienteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nuevo cliente</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-2">
              <Label>Nombre *</Label>
              <Input value={nuevoCliente.nombre} onChange={(e) => setNuevoCliente({ ...nuevoCliente, nombre: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>ID fiscal</Label>
              <Input value={nuevoCliente.identificador_fiscal} onChange={(e) => setNuevoCliente({ ...nuevoCliente, identificador_fiscal: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input value={nuevoCliente.telefono} onChange={(e) => setNuevoCliente({ ...nuevoCliente, telefono: e.target.value })} />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Email</Label>
              <Input type="email" value={nuevoCliente.email} onChange={(e) => setNuevoCliente({ ...nuevoCliente, email: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClienteOpen(false)}>Cancelar</Button>
            <Button onClick={guardarCliente}>Crear y seleccionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
