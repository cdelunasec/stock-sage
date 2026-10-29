import { useEffect, useState, useRef, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAlmacen } from "@/contexts/AlmacenContext";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { NumberInput } from "@/components/ui/number-input";
import { Plus, Pencil, Trash2, Upload, Search, FolderOpen, ArrowLeft, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, formatNumber } from "@/lib/format";
import Papa from "papaparse";
import { useConfirm } from "@/components/ConfirmDialog";
import { logAudit } from "@/lib/audit";

interface Categoria { id: string; nombre: string; }
interface Producto {
  id: string; sku: string; codigo_barras: string | null; nombre: string;
  descripcion: string | null; unidad: string; precio_costo: number; precio_venta: number;
  impuesto_pct: number; stock_minimo: number; categoria_id: string | null; activo: boolean;
  unidad_empaque: string | null; unidades_por_empaque: number | null; permite_venta_empaque: boolean;
}

const empty: Partial<Producto> = {
  sku: "", nombre: "", unidad: "unidad", precio_costo: 0, precio_venta: 0,
  impuesto_pct: 0, stock_minimo: 0, activo: true,
  unidad_empaque: "", unidades_por_empaque: 1, permite_venta_empaque: false,
};

const isUnitario = (u: string) => ["unidad", "caja", "pieza", "fardo", "docena", "paquete"].includes((u || "").toLowerCase());

export default function Productos() {
  const { tenant, canManage, user } = useAuth();
  const { almacenes, almacenActivo } = useAlmacen();
  const [stockInicial, setStockInicial] = useState(0);
  const [stockInicialAlmacen, setStockInicialAlmacen] = useState<string>("");
  const { confirm, dialog } = useConfirm();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [stockMap, setStockMap] = useState<Map<string, number>>(new Map());
  const [search, setSearch] = useState("");
  const [filtroCat, setFiltroCat] = useState<string>("__all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Producto>>(empty);
  const [skuMode, setSkuMode] = useState<"manual" | "auto">("manual");
  const [generandoSku, setGenerandoSku] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [newCat, setNewCat] = useState("");
  const [editCatId, setEditCatId] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState("");
  const [vistaCatActiva, setVistaCatActiva] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const { data: prod } = await supabase.from("productos").select("*").order("nombre");
    setProductos((prod || []) as Producto[]);
    const { data: cats } = await supabase.from("categorias").select("id, nombre").order("nombre");
    setCategorias((cats || []) as Categoria[]);
    const { data: stock } = await supabase.from("stock_levels").select("producto_id, cantidad");
    const m = new Map<string, number>();
    (stock || []).forEach((s) => m.set(s.producto_id, (m.get(s.producto_id) || 0) + Number(s.cantidad)));
    setStockMap(m);
  };

  useEffect(() => { if (tenant) load(); }, [tenant]);

  // Abrir diálogo "Nuevo producto" si la URL trae ?nuevo=1
  const [sp, setSp] = useSearchParams();
  useEffect(() => {
    if (sp.get("nuevo") === "1" && canManage) {
      setEditing(empty); setSkuMode("manual"); setStockInicial(0);
      setStockInicialAlmacen(almacenActivo?.id || "");
      setOpen(true);
      sp.delete("nuevo"); setSp(sp, { replace: true });
    }
  }, [sp, canManage, almacenActivo?.id]);

  const generarSku = async (nombre: string): Promise<string> => {
    const base = (nombre || "PRD")
      .toUpperCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 4) || "PRD";
    const { data } = await supabase
      .from("productos")
      .select("sku")
      .ilike("sku", `${base}-%`);
    const usados = new Set((data || []).map((r) => r.sku));
    let n = (data?.length || 0) + 1;
    let candidato = `${base}-${String(n).padStart(4, "0")}`;
    while (usados.has(candidato)) {
      n++;
      candidato = `${base}-${String(n).padStart(4, "0")}`;
    }
    return candidato;
  };

  // Auto-generar SKU cuando cambia el nombre y el modo es "auto" (solo en creación)
  useEffect(() => {
    if (!open || editing.id || skuMode !== "auto") return;
    const nombre = (editing.nombre || "").trim();
    if (nombre.length < 2) return;
    setGenerandoSku(true);
    const t = setTimeout(async () => {
      const sku = await generarSku(nombre);
      setEditing((prev) => ({ ...prev, sku }));
      setGenerandoSku(false);
    }, 400);
    return () => { clearTimeout(t); setGenerandoSku(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing.nombre, skuMode, open, editing.id]);

  const save = async () => {
    if (!editing.nombre || !editing.sku) { toast.error("SKU y nombre son obligatorios"); return; }
    const payload: any = { ...editing, tenant_id: tenant!.id };
    delete payload.id;
    if (!payload.unidad_empaque) payload.unidad_empaque = null;
    if (!payload.unidades_por_empaque || payload.unidades_por_empaque < 1) payload.unidades_por_empaque = 1;
    let nuevoId: string | undefined;
    if (editing.id) {
      const { error } = await supabase.from("productos").update(payload).eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
      await logAudit("producto_actualizado", "producto", editing.id, { sku: payload.sku, nombre: payload.nombre });
    } else {
      const { data, error } = await supabase.from("productos").insert(payload).select("id").single();
      if (error) { toast.error(error.message); return; }
      nuevoId = data?.id;
      await logAudit("producto_creado", "producto", nuevoId, { sku: payload.sku, nombre: payload.nombre, stock_inicial: stockInicial });
      // Stock inicial opcional
      if (nuevoId && stockInicial > 0) {
        const almId = stockInicialAlmacen || almacenActivo?.id || almacenes[0]?.id;
        if (almId) {
          const { error: e2 } = await supabase.from("stock_movements").insert({
            tenant_id: tenant!.id,
            producto_id: nuevoId,
            almacen_id: almId,
            tipo: "entrada",
            cantidad: stockInicial,
            referencia: "Stock inicial",
            notas: "Registro inicial al crear producto",
            user_id: user?.id,
          });
          if (e2) toast.error(`Producto creado, pero no se pudo registrar el stock inicial: ${e2.message}`);
        }
      }
    }
    toast.success(editing.id ? "Producto actualizado" : "Producto creado");
    setOpen(false); setEditing(empty); setStockInicial(0); setStockInicialAlmacen(""); load();
  };

  const remove = async (p: Producto) => {
    const ok = await confirm({
      title: "¿Eliminar producto?",
      description: `Se eliminará "${p.nombre}".`,
      variant: "destructive", confirmText: "Eliminar",
    });
    if (!ok) return;
    const { error } = await supabase.from("productos").delete().eq("id", p.id);
    if (error) {
      const msg = /foreign key|violates|referenced/i.test(error.message)
        ? "No se puede eliminar: el producto tiene movimientos o ventas asociadas. Edítalo y desactívalo en su lugar."
        : error.message;
      await confirm({ title: "No se pudo eliminar", description: msg, confirmText: "Entendido", cancelText: "Cerrar" });
    } else {
      await logAudit("producto_eliminado", "producto", p.id, { sku: p.sku, nombre: p.nombre });
      toast.success("Eliminado"); load();
    }
  };

  const addCategoria = async () => {
    if (!newCat.trim()) return;
    const { error } = await supabase.from("categorias").insert({ nombre: newCat, tenant_id: tenant!.id });
    if (error) toast.error(error.message);
    else { toast.success("Categoría creada"); setNewCat(""); load(); }
  };

  const guardarCat = async (id: string) => {
    if (!editCatName.trim()) return;
    const { error } = await supabase.from("categorias").update({ nombre: editCatName }).eq("id", id);
    if (error) toast.error(error.message);
    else { setEditCatId(null); load(); }
  };

  const eliminarCat = async (id: string) => {
    const count = productos.filter((p) => p.categoria_id === id).length;
    const cat = categorias.find((c) => c.id === id);
    const ok = await confirm({
      title: "¿Eliminar categoría?",
      description: count > 0
        ? `Esta categoría tiene ${count} producto(s). Si la eliminas, esos productos quedarán sin categoría.`
        : `Se eliminará "${cat?.nombre || "la categoría"}".`,
      variant: "destructive", confirmText: "Eliminar",
    });
    if (!ok) return;
    const { error } = await supabase.from("categorias").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Eliminada"); load(); }
  };

  const handleCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: async (res) => {
        const rows = (res.data as any[]).map((r) => ({
          tenant_id: tenant!.id,
          sku: String(r.sku || "").trim(),
          nombre: String(r.nombre || "").trim(),
          codigo_barras: r.codigo_barras || null,
          unidad: r.unidad || "unidad",
          precio_costo: Number(r.precio_costo) || 0,
          precio_venta: Number(r.precio_venta) || 0,
          impuesto_pct: Number(r.impuesto_pct) || 0,
          stock_minimo: Number(r.stock_minimo) || 0,
        })).filter((r) => r.sku && r.nombre);
        if (rows.length === 0) { toast.error("CSV vacío o sin columnas sku/nombre"); return; }
        const { error } = await supabase.from("productos").insert(rows);
        if (error) toast.error(error.message);
        else { toast.success(`${rows.length} productos importados`); load(); }
      },
    });
    if (fileRef.current) fileRef.current.value = "";
  };

  const filtered = useMemo(() => productos.filter((p) => {
    if (filtroCat !== "__all" && p.categoria_id !== filtroCat) return false;
    if (vistaCatActiva && p.categoria_id !== vistaCatActiva) return false;
    return `${p.sku} ${p.nombre} ${p.codigo_barras || ""}`.toLowerCase().includes(search.toLowerCase());
  }), [productos, filtroCat, vistaCatActiva, search]);

  const conteoCat = useMemo(() => {
    const m = new Map<string, number>();
    productos.forEach((p) => { if (p.categoria_id) m.set(p.categoria_id, (m.get(p.categoria_id) || 0) + 1); });
    return m;
  }, [productos]);

  const sinCategoria = productos.filter((p) => !p.categoria_id).length;
  const editingEsUnitario = isUnitario(editing.unidad || "unidad");

  return (
    <>
      {dialog}
      <PageHeader
        title="Productos"
        description="Catálogo del inventario"
        actions={
          canManage && (
            <>
              <input ref={fileRef} type="file" accept=".csv" onChange={handleCSV} className="hidden" />
              <Button variant="outline" onClick={() => fileRef.current?.click()}>
                <Upload className="mr-2 h-4 w-4" />Importar CSV
              </Button>
              <Button variant="outline" onClick={() => setCatOpen(true)}>Categorías</Button>
              <Button onClick={() => { setEditing(empty); setSkuMode("manual"); setStockInicial(0); setStockInicialAlmacen(almacenActivo?.id || ""); setOpen(true); }}>
                <Plus className="mr-2 h-4 w-4" />Nuevo
              </Button>
            </>
          )
        }
      />

      <Tabs defaultValue="lista" onValueChange={() => setVistaCatActiva(null)}>
        <TabsList>
          <TabsTrigger value="lista">Lista</TabsTrigger>
          <TabsTrigger value="categorias">Por categoría</TabsTrigger>
        </TabsList>

        <TabsContent value="lista" className="mt-4">
          <Card className="shadow-soft">
            <CardContent className="p-0">
              <div className="flex flex-wrap gap-2 border-b p-4">
                <div className="relative max-w-sm flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Buscar SKU, nombre o código..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <Select value={filtroCat} onValueChange={setFiltroCat}>
                  <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all">Todas las categorías</SelectItem>
                    {categorias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead className="text-right">Costo</TableHead>
                    <TableHead className="text-right">Precio</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => {
                    const cat = categorias.find((c) => c.id === p.categoria_id);
                    const qty = stockMap.get(p.id) || 0;
                    const low = p.stock_minimo > 0 && qty <= p.stock_minimo;
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                        <TableCell className="font-medium">
                          {p.nombre}
                          {p.unidad_empaque && (
                            <div className="text-xs text-muted-foreground">{p.unidad_empaque} · {p.unidades_por_empaque} uni</div>
                          )}
                        </TableCell>
                        <TableCell>{cat?.nombre || <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell className="text-right">{formatCurrency(p.precio_costo, tenant?.moneda)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(p.precio_venta, tenant?.moneda)}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={low ? "destructive" : "secondary"}>{formatNumber(qty, 0)} {p.unidad}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {canManage && (
                            <div className="flex justify-end gap-1">
                              <Button size="icon" variant="ghost" onClick={() => { setEditing(p); setSkuMode("manual"); setOpen(true); }}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => remove(p)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filtered.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">Sin productos</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categorias" className="mt-4">
          {!vistaCatActiva ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {categorias.map((c) => (
                <Card key={c.id} className="cursor-pointer shadow-soft transition-colors hover:bg-accent/50" onClick={() => setVistaCatActiva(c.id)}>
                  <CardContent className="flex items-center gap-3 p-5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <FolderOpen className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{c.nombre}</div>
                      <div className="text-xs text-muted-foreground">{conteoCat.get(c.id) || 0} productos</div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {sinCategoria > 0 && (
                <Card className="cursor-pointer shadow-soft transition-colors hover:bg-accent/50" onClick={() => setVistaCatActiva("__sin")}>
                  <CardContent className="flex items-center gap-3 p-5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <FolderOpen className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">Sin categoría</div>
                      <div className="text-xs text-muted-foreground">{sinCategoria} productos</div>
                    </div>
                  </CardContent>
                </Card>
              )}
              {categorias.length === 0 && (
                <p className="col-span-full text-sm text-muted-foreground">Aún no hay categorías. Crea una desde "Categorías".</p>
              )}
            </div>
          ) : (
            <>
              <div className="mb-3 flex items-center gap-2 text-sm">
                <Button variant="ghost" size="sm" onClick={() => setVistaCatActiva(null)}>
                  <ArrowLeft className="mr-1 h-4 w-4" />Todas
                </Button>
                <span className="text-muted-foreground">/</span>
                <span className="font-medium">
                  {vistaCatActiva === "__sin" ? "Sin categoría" : categorias.find((c) => c.id === vistaCatActiva)?.nombre}
                </span>
              </div>
              <Card className="shadow-soft">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>SKU</TableHead>
                        <TableHead>Nombre</TableHead>
                        <TableHead className="text-right">Precio</TableHead>
                        <TableHead className="text-right">Stock</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {productos
                        .filter((p) => vistaCatActiva === "__sin" ? !p.categoria_id : p.categoria_id === vistaCatActiva)
                        .map((p) => {
                          const qty = stockMap.get(p.id) || 0;
                          return (
                            <TableRow key={p.id}>
                              <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                              <TableCell className="font-medium">{p.nombre}</TableCell>
                              <TableCell className="text-right">{formatCurrency(p.precio_venta, tenant?.moneda)}</TableCell>
                              <TableCell className="text-right">{formatNumber(qty, 0)} {p.unidad}</TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog producto */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing.id ? "Editar producto" : "Nuevo producto"}</DialogTitle>
            <DialogDescription>Completa los datos del producto</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>SKU *</Label>
                {!editing.id && (
                  <div className="flex items-center gap-1 rounded-md border bg-muted/30 p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setSkuMode("manual")}
                      className={`px-2 py-0.5 rounded ${skuMode === "manual" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
                    >Manual</button>
                    <button
                      type="button"
                      onClick={() => setSkuMode("auto")}
                      className={`px-2 py-0.5 rounded ${skuMode === "auto" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
                    >Automático</button>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  value={editing.sku || ""}
                  onChange={(e) => setEditing({ ...editing, sku: e.target.value })}
                  placeholder={skuMode === "auto" ? "Se generará al escribir el nombre" : "Ej: PROD-0001"}
                  readOnly={skuMode === "auto" && !editing.id}
                  className={skuMode === "auto" && !editing.id ? "bg-muted/40" : ""}
                />
                {skuMode === "auto" && !editing.id && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    disabled={generandoSku || !(editing.nombre || "").trim()}
                    onClick={async () => {
                      setGenerandoSku(true);
                      const sku = await generarSku(editing.nombre || "");
                      setEditing({ ...editing, sku });
                      setGenerandoSku(false);
                    }}
                    title="Regenerar SKU"
                  >
                    <Wand2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {skuMode === "auto" && !editing.id && generandoSku && (
                <p className="text-xs text-muted-foreground">Generando SKU único...</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Código de barras</Label>
              <Input value={editing.codigo_barras || ""} onChange={(e) => setEditing({ ...editing, codigo_barras: e.target.value })} />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Nombre *</Label>
              <Input value={editing.nombre || ""} onChange={(e) => setEditing({ ...editing, nombre: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Categoría</Label>
              <Select value={editing.categoria_id || ""} onValueChange={(v) => setEditing({ ...editing, categoria_id: v || null })}>
                <SelectTrigger><SelectValue placeholder="Sin categoría" /></SelectTrigger>
                <SelectContent>
                  {categorias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Unidad base (venta)</Label>
              <Input value={editing.unidad || ""} onChange={(e) => setEditing({ ...editing, unidad: e.target.value })} placeholder="unidad, kg, lt..." />
            </div>
            <div className="space-y-2">
              <Label>Precio costo</Label>
              <NumberInput value={editing.precio_costo ?? 0} onChange={(v) => setEditing({ ...editing, precio_costo: v })} />
            </div>
            <div className="space-y-2">
              <Label>Precio venta</Label>
              <NumberInput value={editing.precio_venta ?? 0} onChange={(v) => setEditing({ ...editing, precio_venta: v })} />
            </div>
            <div className="space-y-2">
              <Label>Impuesto %</Label>
              <NumberInput value={editing.impuesto_pct ?? 0} onChange={(v) => setEditing({ ...editing, impuesto_pct: v })} />
            </div>
            <div className="space-y-2">
              <Label>Stock mínimo</Label>
              <NumberInput integer={editingEsUnitario} value={editing.stock_minimo ?? 0} onChange={(v) => setEditing({ ...editing, stock_minimo: v })} />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Descripción</Label>
              <Textarea value={editing.descripcion || ""} onChange={(e) => setEditing({ ...editing, descripcion: e.target.value })} />
            </div>

            {/* Sección compra al por mayor */}
            <div className="col-span-2 mt-2 rounded-lg border bg-muted/30 p-4">
              <h4 className="mb-3 text-sm font-semibold">Compra al por mayor (empaques)</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Unidad de empaque</Label>
                  <Input value={editing.unidad_empaque || ""} onChange={(e) => setEditing({ ...editing, unidad_empaque: e.target.value })} placeholder="caja, fardo, docena" />
                </div>
                <div className="space-y-2">
                  <Label>Unidades por empaque</Label>
                  <NumberInput integer value={editing.unidades_por_empaque ?? 1} min={1} onChange={(v) => setEditing({ ...editing, unidades_por_empaque: v })} />
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <Switch checked={editing.permite_venta_empaque ?? false} onCheckedChange={(v) => setEditing({ ...editing, permite_venta_empaque: v })} />
                  <Label>Permitir vender por empaque (descuenta unidades equivalentes)</Label>
                </div>
              </div>
            </div>

            {/* Stock inicial — solo al crear */}
            {!editing.id && (
              <div className="col-span-2 mt-2 rounded-lg border bg-muted/30 p-4">
                <h4 className="mb-3 text-sm font-semibold">Stock inicial (opcional)</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Cantidad inicial</Label>
                    <NumberInput
                      integer={editingEsUnitario}
                      value={stockInicial}
                      min={0}
                      onChange={setStockInicial}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Almacén</Label>
                    <Select
                      value={stockInicialAlmacen || almacenActivo?.id || ""}
                      onValueChange={setStockInicialAlmacen}
                      disabled={stockInicial <= 0}
                    >
                      <SelectTrigger><SelectValue placeholder="Selecciona almacén" /></SelectTrigger>
                      <SelectContent>
                        {almacenes.map((a) => <SelectItem key={a.id} value={a.id}>{a.nombre}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Si indicas una cantidad mayor a 0, se registrará automáticamente como entrada en el almacén seleccionado.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog categorías */}
      <Dialog open={catOpen} onOpenChange={setCatOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Categorías</DialogTitle></DialogHeader>
          <ul className="max-h-72 space-y-1 overflow-y-auto">
            {categorias.map((c) => (
              <li key={c.id} className="flex items-center gap-2 rounded-md border p-2">
                {editCatId === c.id ? (
                  <>
                    <Input value={editCatName} onChange={(e) => setEditCatName(e.target.value)} className="h-8" />
                    <Button size="sm" onClick={() => guardarCat(c.id)}>OK</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditCatId(null)}>X</Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm">{c.nombre}</span>
                    <span className="text-xs text-muted-foreground">{conteoCat.get(c.id) || 0}</span>
                    <Button size="icon" variant="ghost" onClick={() => { setEditCatId(c.id); setEditCatName(c.nombre); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => eliminarCat(c.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </li>
            ))}
            {categorias.length === 0 && <li className="text-sm text-muted-foreground">Sin categorías</li>}
          </ul>
          <div className="flex gap-2">
            <Input placeholder="Nueva categoría" value={newCat} onChange={(e) => setNewCat(e.target.value)} />
            <Button onClick={addCategoria}>Agregar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
