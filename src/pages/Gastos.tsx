import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { NumberInput } from "@/components/ui/number-input";
import { Plus, Trash2, Pencil, RotateCw, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Gasto = {
  id: string; concepto: string; categoria: string | null; monto: number;
  fecha: string; metodo_pago: string | null; proveedor_id: string | null;
  recurrente_id: string | null; notas: string | null;
};
type Recurrente = {
  id: string; concepto: string; categoria: string | null; monto: number;
  frecuencia: "mensual" | "semanal" | "quincenal" | "anual";
  proximo_vencimiento: string; activo: boolean; proveedor_id: string | null; notas: string | null;
};

const CATEGORIAS = ["Servicios", "Alquiler", "Sueldos", "Compras", "Impuestos", "Marketing", "Transporte", "Otros"];
const METODOS = ["Efectivo", "Transferencia", "Tarjeta", "Cheque", "Otro"];

function nextDate(from: string, freq: Recurrente["frecuencia"]) {
  const d = new Date(from + "T00:00:00");
  if (freq === "semanal") d.setDate(d.getDate() + 7);
  else if (freq === "quincenal") d.setDate(d.getDate() + 15);
  else if (freq === "mensual") d.setMonth(d.getMonth() + 1);
  else if (freq === "anual") d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

export default function Gastos() {
  const { tenant, user } = useAuth();
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [recurrentes, setRecurrentes] = useState<Recurrente[]>([]);
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // dialog gasto
  const [openG, setOpenG] = useState(false);
  const [editG, setEditG] = useState<Gasto | null>(null);
  const [fG, setFG] = useState({ concepto: "", categoria: "", monto: 0, fecha: new Date().toISOString().slice(0, 10), metodo_pago: "", proveedor_id: "", notas: "" });

  // dialog recurrente
  const [openR, setOpenR] = useState(false);
  const [editR, setEditR] = useState<Recurrente | null>(null);
  const [fR, setFR] = useState({ concepto: "", categoria: "", monto: 0, frecuencia: "mensual" as Recurrente["frecuencia"], proximo_vencimiento: new Date().toISOString().slice(0, 10), activo: true, proveedor_id: "", notas: "" });

  const [delG, setDelG] = useState<Gasto | null>(null);
  const [delR, setDelR] = useState<Recurrente | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: g }, { data: r }, { data: p }] = await Promise.all([
      (supabase as any).from("gastos").select("*").order("fecha", { ascending: false }),
      (supabase as any).from("gastos_recurrentes").select("*").order("proximo_vencimiento"),
      supabase.from("proveedores").select("id, nombre").order("nombre"),
    ]);
    setGastos(g || []); setRecurrentes(r || []); setProveedores(p || []);
    setLoading(false);
  };
  useEffect(() => { if (tenant) load(); }, [tenant]);

  const totalMes = useMemo(() => {
    const ym = new Date().toISOString().slice(0, 7);
    return gastos.filter((g) => g.fecha.startsWith(ym)).reduce((s, g) => s + Number(g.monto), 0);
  }, [gastos]);

  const vencidos = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return recurrentes.filter((r) => r.activo && r.proximo_vencimiento <= today);
  }, [recurrentes]);

  // ---- Gasto puntual ----
  const openNuevoG = () => {
    setEditG(null);
    setFG({ concepto: "", categoria: "", monto: 0, fecha: new Date().toISOString().slice(0, 10), metodo_pago: "", proveedor_id: "", notas: "" });
    setOpenG(true);
  };
  const openEditG = (g: Gasto) => {
    setEditG(g);
    setFG({
      concepto: g.concepto, categoria: g.categoria || "", monto: Number(g.monto),
      fecha: g.fecha, metodo_pago: g.metodo_pago || "", proveedor_id: g.proveedor_id || "", notas: g.notas || "",
    });
    setOpenG(true);
  };
  const saveG = async () => {
    if (!fG.concepto.trim() || fG.monto <= 0) { toast.error("Concepto y monto requeridos"); return; }
    const payload = {
      tenant_id: tenant!.id,
      concepto: fG.concepto.trim(),
      categoria: fG.categoria || null,
      monto: fG.monto,
      fecha: fG.fecha,
      metodo_pago: fG.metodo_pago || null,
      proveedor_id: fG.proveedor_id || null,
      notas: fG.notas || null,
      user_id: user?.id,
    };
    const { error } = editG
      ? await (supabase as any).from("gastos").update(payload).eq("id", editG.id)
      : await (supabase as any).from("gastos").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(editG ? "Gasto actualizado" : "Gasto registrado");
    setOpenG(false); load();
  };
  const removeG = async () => {
    if (!delG) return;
    const { error } = await (supabase as any).from("gastos").delete().eq("id", delG.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Gasto eliminado"); setDelG(null); load();
  };

  // ---- Recurrente ----
  const openNuevoR = () => {
    setEditR(null);
    setFR({ concepto: "", categoria: "", monto: 0, frecuencia: "mensual", proximo_vencimiento: new Date().toISOString().slice(0, 10), activo: true, proveedor_id: "", notas: "" });
    setOpenR(true);
  };
  const openEditR = (r: Recurrente) => {
    setEditR(r);
    setFR({
      concepto: r.concepto, categoria: r.categoria || "", monto: Number(r.monto),
      frecuencia: r.frecuencia, proximo_vencimiento: r.proximo_vencimiento, activo: r.activo,
      proveedor_id: r.proveedor_id || "", notas: r.notas || "",
    });
    setOpenR(true);
  };
  const saveR = async () => {
    if (!fR.concepto.trim() || fR.monto <= 0) { toast.error("Concepto y monto requeridos"); return; }
    const payload = {
      tenant_id: tenant!.id,
      concepto: fR.concepto.trim(),
      categoria: fR.categoria || null,
      monto: fR.monto,
      frecuencia: fR.frecuencia,
      proximo_vencimiento: fR.proximo_vencimiento,
      activo: fR.activo,
      proveedor_id: fR.proveedor_id || null,
      notas: fR.notas || null,
      user_id: user?.id,
    };
    const { error } = editR
      ? await (supabase as any).from("gastos_recurrentes").update(payload).eq("id", editR.id)
      : await (supabase as any).from("gastos_recurrentes").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(editR ? "Plantilla actualizada" : "Gasto recurrente creado");
    setOpenR(false); load();
  };
  const removeR = async () => {
    if (!delR) return;
    const { error } = await (supabase as any).from("gastos_recurrentes").delete().eq("id", delR.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Plantilla eliminada"); setDelR(null); load();
  };

  const generarDesdeRecurrente = async (r: Recurrente) => {
    // Inserta gasto puntual con la fecha del próximo_vencimiento y avanza la fecha
    const { error: e1 } = await (supabase as any).from("gastos").insert({
      tenant_id: tenant!.id,
      concepto: r.concepto,
      categoria: r.categoria,
      monto: r.monto,
      fecha: r.proximo_vencimiento,
      proveedor_id: r.proveedor_id,
      recurrente_id: r.id,
      notas: r.notas,
      user_id: user?.id,
    });
    if (e1) { toast.error(e1.message); return; }
    const { error: e2 } = await (supabase as any).from("gastos_recurrentes")
      .update({ proximo_vencimiento: nextDate(r.proximo_vencimiento, r.frecuencia) })
      .eq("id", r.id);
    if (e2) { toast.error(e2.message); return; }
    toast.success(`Gasto "${r.concepto}" generado`);
    load();
  };

  const provName = (id: string | null) => proveedores.find((p) => p.id === id)?.nombre || "—";

  return (
    <>
      <PageHeader title="Gastos" description="Egresos puntuales y recurrentes" />

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card className="shadow-soft">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Gastos del mes</p>
            <p className="text-2xl font-semibold mt-1">{formatCurrency(totalMes, tenant?.moneda)}</p>
          </CardContent>
        </Card>
        <Card className="shadow-soft">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Recurrentes activos</p>
            <p className="text-2xl font-semibold mt-1">{recurrentes.filter((r) => r.activo).length}</p>
          </CardContent>
        </Card>
        <Card className={`shadow-soft ${vencidos.length ? "border-destructive" : ""}`}>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              {vencidos.length > 0 && <AlertCircle className="h-3.5 w-3.5 text-destructive" />}
              Vencidos / por generar
            </p>
            <p className="text-2xl font-semibold mt-1">{vencidos.length}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="puntuales">
        <TabsList>
          <TabsTrigger value="puntuales">Gastos puntuales</TabsTrigger>
          <TabsTrigger value="recurrentes">Recurrentes</TabsTrigger>
        </TabsList>

        <TabsContent value="puntuales" className="mt-4">
          <Card className="shadow-soft">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Historial de gastos</CardTitle>
              <Button onClick={openNuevoG}><Plus className="h-4 w-4 mr-1" />Nuevo gasto</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Concepto</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">Cargando...</TableCell></TableRow>}
                  {!loading && gastos.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">Sin gastos registrados</TableCell></TableRow>}
                  {gastos.map((g) => (
                    <TableRow key={g.id}>
                      <TableCell className="whitespace-nowrap">{g.fecha}</TableCell>
                      <TableCell className="font-medium">
                        {g.concepto}
                        {g.recurrente_id && <Badge variant="secondary" className="ml-2 text-[10px]">recurrente</Badge>}
                      </TableCell>
                      <TableCell>{g.categoria || "—"}</TableCell>
                      <TableCell>{provName(g.proveedor_id)}</TableCell>
                      <TableCell>{g.metodo_pago || "—"}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(Number(g.monto), tenant?.moneda)}</TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" onClick={() => openEditG(g)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => setDelG(g)}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recurrentes" className="mt-4">
          <Card className="shadow-soft">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Plantillas de gastos recurrentes</CardTitle>
              <Button onClick={openNuevoR}><Plus className="h-4 w-4 mr-1" />Nueva plantilla</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Concepto</TableHead>
                    <TableHead>Frecuencia</TableHead>
                    <TableHead>Próximo</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">Cargando...</TableCell></TableRow>}
                  {!loading && recurrentes.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">Sin plantillas</TableCell></TableRow>}
                  {recurrentes.map((r) => {
                    const today = new Date().toISOString().slice(0, 10);
                    const venc = r.activo && r.proximo_vencimiento <= today;
                    return (
                      <TableRow key={r.id} className={venc ? "bg-destructive/5" : ""}>
                        <TableCell className="font-medium">{r.concepto}</TableCell>
                        <TableCell className="capitalize">{r.frecuencia}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {r.proximo_vencimiento}
                          {venc && <Badge variant="destructive" className="ml-2 text-[10px]">vencido</Badge>}
                        </TableCell>
                        <TableCell>{r.categoria || "—"}</TableCell>
                        <TableCell>
                          <Badge variant={r.activo ? "default" : "secondary"}>{r.activo ? "Activo" : "Pausado"}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(Number(r.monto), tenant?.moneda)}</TableCell>
                        <TableCell className="text-right">
                          <Button size="icon" variant="ghost" title="Generar gasto" onClick={() => generarDesdeRecurrente(r)} disabled={!r.activo}>
                            <RotateCw className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => openEditR(r)}><Pencil className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => setDelR(r)}><Trash2 className="h-4 w-4" /></Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog Gasto */}
      <Dialog open={openG} onOpenChange={setOpenG}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editG ? "Editar gasto" : "Nuevo gasto"}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1.5"><Label>Concepto *</Label><Input value={fG.concepto} onChange={(e) => setFG({ ...fG, concepto: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Monto *</Label><NumberInput value={fG.monto} onChange={(v) => setFG({ ...fG, monto: v })} /></div>
              <div className="space-y-1.5"><Label>Fecha</Label><Input type="date" value={fG.fecha} onChange={(e) => setFG({ ...fG, fecha: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Categoría</Label>
                <Select value={fG.categoria || "__none"} onValueChange={(v) => setFG({ ...fG, categoria: v === "__none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Sin categoría" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Sin categoría</SelectItem>
                    {CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Método de pago</Label>
                <Select value={fG.metodo_pago || "__none"} onValueChange={(v) => setFG({ ...fG, metodo_pago: v === "__none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">—</SelectItem>
                    {METODOS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Proveedor</Label>
              <Select value={fG.proveedor_id || "__none"} onValueChange={(v) => setFG({ ...fG, proveedor_id: v === "__none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Sin proveedor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Sin proveedor</SelectItem>
                  {proveedores.map((p) => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Notas</Label><Textarea rows={2} value={fG.notas} onChange={(e) => setFG({ ...fG, notas: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenG(false)}>Cancelar</Button>
            <Button onClick={saveG}>{editG ? "Guardar" : "Registrar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Recurrente */}
      <Dialog open={openR} onOpenChange={setOpenR}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editR ? "Editar plantilla" : "Nueva plantilla recurrente"}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1.5"><Label>Concepto *</Label><Input value={fR.concepto} onChange={(e) => setFR({ ...fR, concepto: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Monto *</Label><NumberInput value={fR.monto} onChange={(v) => setFR({ ...fR, monto: v })} /></div>
              <div className="space-y-1.5">
                <Label>Frecuencia</Label>
                <Select value={fR.frecuencia} onValueChange={(v: any) => setFR({ ...fR, frecuencia: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="semanal">Semanal</SelectItem>
                    <SelectItem value="quincenal">Quincenal</SelectItem>
                    <SelectItem value="mensual">Mensual</SelectItem>
                    <SelectItem value="anual">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Próximo vencimiento</Label><Input type="date" value={fR.proximo_vencimiento} onChange={(e) => setFR({ ...fR, proximo_vencimiento: e.target.value })} /></div>
              <div className="space-y-1.5">
                <Label>Categoría</Label>
                <Select value={fR.categoria || "__none"} onValueChange={(v) => setFR({ ...fR, categoria: v === "__none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Sin categoría" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Sin categoría</SelectItem>
                    {CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Proveedor</Label>
              <Select value={fR.proveedor_id || "__none"} onValueChange={(v) => setFR({ ...fR, proveedor_id: v === "__none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Sin proveedor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Sin proveedor</SelectItem>
                  {proveedores.map((p) => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <input id="activoR" type="checkbox" checked={fR.activo} onChange={(e) => setFR({ ...fR, activo: e.target.checked })} />
              <Label htmlFor="activoR" className="cursor-pointer">Activo</Label>
            </div>
            <div className="space-y-1.5"><Label>Notas</Label><Textarea rows={2} value={fR.notas} onChange={(e) => setFR({ ...fR, notas: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenR(false)}>Cancelar</Button>
            <Button onClick={saveR}>{editR ? "Guardar" : "Crear"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!delG} onOpenChange={(o) => !o && setDelG(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar gasto</AlertDialogTitle>
            <AlertDialogDescription>¿Eliminar "{delG?.concepto}"?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={removeG} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!delR} onOpenChange={(o) => !o && setDelR(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar plantilla</AlertDialogTitle>
            <AlertDialogDescription>¿Eliminar "{delR?.concepto}"? Los gastos generados se mantienen.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={removeR} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
