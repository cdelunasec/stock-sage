import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";
import { useConfirm } from "@/components/ConfirmDialog";

interface Servicio {
  id: string; nombre: string; descripcion: string | null;
  precio: number; impuesto_pct: number; activo: boolean;
}
const empty: Partial<Servicio> = { nombre: "", descripcion: "", precio: 0, impuesto_pct: 0, activo: true };

export default function Servicios() {
  const { tenant, canManage } = useAuth();
  const { confirm, dialog } = useConfirm();
  const [list, setList] = useState<Servicio[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Servicio>>(empty);

  const load = async () => {
    const { data } = await (supabase as any).from("servicios").select("*").order("nombre");
    setList((data || []) as Servicio[]);
  };
  useEffect(() => { if (tenant) load(); }, [tenant]);

  const save = async () => {
    if (!editing.nombre) { toast.error("Nombre obligatorio"); return; }
    const payload: any = { ...editing, tenant_id: tenant!.id };
    delete payload.id;
    const { error } = editing.id
      ? await (supabase as any).from("servicios").update(payload).eq("id", editing.id)
      : await (supabase as any).from("servicios").insert(payload);
    if (error) toast.error(error.message);
    else { toast.success("Guardado"); setOpen(false); setEditing(empty); load(); }
  };

  const remove = async (s: Servicio) => {
    const ok = await confirm({
      title: "¿Eliminar servicio?",
      description: `Se eliminará "${s.nombre}". Esta acción no se puede deshacer.`,
      variant: "destructive",
      confirmText: "Eliminar",
    });
    if (!ok) return;
    const { error } = await (supabase as any).from("servicios").delete().eq("id", s.id);
    if (error) toast.error(error.message);
    else { toast.success("Eliminado"); load(); }
  };

  return (
    <>
      {dialog}
      <PageHeader
        title="Servicios"
        description="Servicios vendibles sin manejo de stock"
        actions={canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditing(empty)}><Plus className="mr-2 h-4 w-4" />Nuevo</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editing.id ? "Editar" : "Nuevo"} servicio</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Nombre *</Label>
                  <Input value={editing.nombre || ""} onChange={(e) => setEditing({ ...editing, nombre: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Descripción</Label>
                  <Textarea rows={2} value={editing.descripcion || ""} onChange={(e) => setEditing({ ...editing, descripcion: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Precio</Label>
                    <NumberInput
                      integer
                      min={0}
                      value={editing.precio ?? 0}
                      onChange={(n) => setEditing({ ...editing, precio: n })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Impuesto %</Label>
                    <NumberInput
                      integer
                      min={0}
                      max={100}
                      value={editing.impuesto_pct ?? 0}
                      onChange={(n) => setEditing({ ...editing, impuesto_pct: n })}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={editing.activo ?? true} onCheckedChange={(v) => setEditing({ ...editing, activo: v })} />
                  <Label>Activo</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={save}>Guardar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      />

      <Card className="shadow-soft">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                <TableHead className="text-right">Imp. %</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.nombre}</TableCell>
                  <TableCell className="text-muted-foreground max-w-md truncate">{s.descripcion || "—"}</TableCell>
                  <TableCell className="text-right">{formatCurrency(s.precio, tenant?.moneda)}</TableCell>
                  <TableCell className="text-right">{s.impuesto_pct}%</TableCell>
                  <TableCell>
                    <Badge variant={s.activo ? "default" : "secondary"}>{s.activo ? "Activo" : "Inactivo"}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {canManage && (
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => { setEditing(s); setOpen(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => remove(s)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {list.length === 0 && (
                <TableRow><TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">Sin servicios. Crea el primero.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
