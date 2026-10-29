import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Truck } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/ConfirmDialog";

interface Tipo { id: string; nombre: string; }
interface Proveedor {
  id: string; nombre: string; contacto: string | null; telefono: string | null;
  email: string | null; direccion: string | null; identificador_fiscal: string | null;
  condiciones_pago: string | null; notas: string | null; activo: boolean;
  tipo_proveedor_id: string | null;
}

export default function Proveedores() {
  const { tenant, canManage } = useAuth();
  const { confirm, dialog } = useConfirm();
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [tipos, setTipos] = useState<Tipo[]>([]);
  const [filtroTipo, setFiltroTipo] = useState<string>("__all");
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Proveedor | null>(null);
  const [form, setForm] = useState<Partial<Proveedor>>({});

  const [openTipos, setOpenTipos] = useState(false);
  const [nuevoTipo, setNuevoTipo] = useState("");

  const load = async () => {
    setLoading(true);
    const [{ data: provs }, { data: tipoList }] = await Promise.all([
      supabase.from("proveedores").select("*").order("nombre"),
      supabase.from("tipos_proveedor").select("*").order("nombre"),
    ]);
    setProveedores(provs || []);
    setTipos(tipoList || []);
    setLoading(false);
  };

  useEffect(() => { if (tenant) load(); }, [tenant]);

  const abrirNuevo = () => {
    setEditing(null);
    setForm({ activo: true });
    setOpen(true);
  };
  const abrirEditar = (p: Proveedor) => { setEditing(p); setForm(p); setOpen(true); };

  const guardar = async () => {
    if (!form.nombre?.trim()) { toast.error("Nombre requerido"); return; }
    if (editing) {
      const { error } = await supabase.from("proveedores").update({
        nombre: form.nombre, contacto: form.contacto || null, telefono: form.telefono || null,
        email: form.email || null, direccion: form.direccion || null,
        identificador_fiscal: form.identificador_fiscal || null,
        condiciones_pago: form.condiciones_pago || null, notas: form.notas || null,
        activo: form.activo ?? true, tipo_proveedor_id: form.tipo_proveedor_id || null,
      }).eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Proveedor actualizado");
    } else {
      const { error } = await supabase.from("proveedores").insert({
        tenant_id: tenant!.id,
        nombre: form.nombre!, contacto: form.contacto || null, telefono: form.telefono || null,
        email: form.email || null, direccion: form.direccion || null,
        identificador_fiscal: form.identificador_fiscal || null,
        condiciones_pago: form.condiciones_pago || null, notas: form.notas || null,
        activo: form.activo ?? true, tipo_proveedor_id: form.tipo_proveedor_id || null,
      });
      if (error) { toast.error(error.message); return; }
      toast.success("Proveedor creado");
    }
    setOpen(false); load();
  };

  const eliminar = async (id: string, nombre: string) => {
    const ok = await confirm({
      title: "¿Eliminar proveedor?",
      description: `Se eliminará "${nombre}".`,
      variant: "destructive", confirmText: "Eliminar",
    });
    if (!ok) return;
    const { error } = await supabase.from("proveedores").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Eliminado"); load();
  };

  const crearTipo = async () => {
    if (!nuevoTipo.trim()) return;
    const { error } = await supabase.from("tipos_proveedor").insert({
      tenant_id: tenant!.id, nombre: nuevoTipo.trim(),
    });
    if (error) { toast.error(error.message); return; }
    setNuevoTipo(""); load();
  };

  const eliminarTipo = async (id: string) => {
    const ok = await confirm({
      title: "¿Eliminar tipo?",
      description: "Se eliminará este tipo de proveedor.",
      variant: "destructive", confirmText: "Eliminar",
    });
    if (!ok) return;
    const { error } = await supabase.from("tipos_proveedor").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  const filtrados = filtroTipo === "__all"
    ? proveedores
    : proveedores.filter((p) => p.tipo_proveedor_id === filtroTipo);

  const tipoNombre = (id: string | null) => tipos.find((t) => t.id === id)?.nombre || "—";

  return (
    <>
      {dialog}
      <PageHeader
        title="Proveedores"
        description="Gestión de proveedores y categorías"
        actions={canManage && (
          <>
            <Button variant="outline" onClick={() => setOpenTipos(true)}>Tipos</Button>
            <Button onClick={abrirNuevo}><Plus className="mr-2 h-4 w-4" />Nuevo proveedor</Button>
          </>
        )}
      />

      <div className="mb-4 flex gap-2">
        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="w-64"><SelectValue placeholder="Filtrar por tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">Todos los tipos</SelectItem>
            {tipos.map((t) => <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card className="shadow-soft">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={7} className="py-6 text-center text-sm text-muted-foreground">Cargando…</TableCell></TableRow>}
              {!loading && filtrados.length === 0 && (
                <TableRow><TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  <Truck className="mx-auto mb-2 h-8 w-8 opacity-40" />Sin proveedores
                </TableCell></TableRow>
              )}
              {filtrados.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.nombre}</TableCell>
                  <TableCell><Badge variant="outline">{tipoNombre(p.tipo_proveedor_id)}</Badge></TableCell>
                  <TableCell>{p.contacto || "—"}</TableCell>
                  <TableCell>{p.telefono || "—"}</TableCell>
                  <TableCell>{p.email || "—"}</TableCell>
                  <TableCell>{p.activo ? <Badge>Activo</Badge> : <Badge variant="secondary">Inactivo</Badge>}</TableCell>
                  <TableCell className="text-right">
                    {canManage && (
                      <>
                        <Button size="icon" variant="ghost" onClick={() => abrirEditar(p)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => eliminar(p.id, p.nombre)}><Trash2 className="h-4 w-4" /></Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog proveedor */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? "Editar" : "Nuevo"} proveedor</DialogTitle></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Nombre *</Label>
              <Input value={form.nombre || ""} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={form.tipo_proveedor_id || ""} onValueChange={(v) => setForm({ ...form, tipo_proveedor_id: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {tipos.map((t) => <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Identificador fiscal</Label>
              <Input value={form.identificador_fiscal || ""} onChange={(e) => setForm({ ...form, identificador_fiscal: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Contacto</Label>
              <Input value={form.contacto || ""} onChange={(e) => setForm({ ...form, contacto: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input value={form.telefono || ""} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Email</Label>
              <Input value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Dirección</Label>
              <Input value={form.direccion || ""} onChange={(e) => setForm({ ...form, direccion: e.target.value })} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Condiciones de pago</Label>
              <Input placeholder="Ej: Crédito 30 días" value={form.condiciones_pago || ""} onChange={(e) => setForm({ ...form, condiciones_pago: e.target.value })} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Notas</Label>
              <Textarea rows={3} value={form.notas || ""} onChange={(e) => setForm({ ...form, notas: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={guardar}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog tipos */}
      <Dialog open={openTipos} onOpenChange={setOpenTipos}>
        <DialogContent>
          <DialogHeader><DialogTitle>Tipos de proveedor</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input placeholder="Ej: Mayorista" value={nuevoTipo} onChange={(e) => setNuevoTipo(e.target.value)} />
              <Button onClick={crearTipo}>Agregar</Button>
            </div>
            <div className="space-y-1">
              {tipos.map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded border p-2">
                  <span>{t.nombre}</span>
                  <Button size="icon" variant="ghost" onClick={() => eliminarTipo(t.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
