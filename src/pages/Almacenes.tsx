import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAlmacen } from "@/contexts/AlmacenContext";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/ConfirmDialog";

interface Almacen { id: string; nombre: string; direccion: string | null; activo: boolean; }

export default function Almacenes() {
  const { tenant, isAdmin } = useAuth();
  const { reload } = useAlmacen();
  const { confirm, dialog } = useConfirm();
  const [list, setList] = useState<Almacen[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Almacen>>({ nombre: "", direccion: "", activo: true });

  const load = async () => {
    const { data } = await supabase.from("almacenes").select("*").order("nombre");
    setList((data || []) as Almacen[]);
  };
  useEffect(() => { if (tenant) load(); }, [tenant]);

  const save = async () => {
    if (!editing.nombre) { toast.error("Nombre obligatorio"); return; }
    const payload: any = { ...editing, tenant_id: tenant!.id };
    delete payload.id;
    const { error } = editing.id
      ? await supabase.from("almacenes").update(payload).eq("id", editing.id)
      : await supabase.from("almacenes").insert(payload);
    if (error) toast.error(error.message);
    else { toast.success("Guardado"); setOpen(false); setEditing({ nombre: "", direccion: "", activo: true }); load(); reload(); }
  };

  const remove = async (a: Almacen) => {
    const ok = await confirm({
      title: "¿Eliminar almacén?",
      description: `Se eliminará "${a.nombre}". Si tiene movimientos o stock asociado, no podrá borrarse — en ese caso conviene desactivarlo.`,
      variant: "destructive",
      confirmText: "Eliminar",
    });
    if (!ok) return;
    const { error } = await supabase.from("almacenes").delete().eq("id", a.id);
    if (error) {
      const msg = /foreign key|violates|referenced/i.test(error.message)
        ? "No se puede eliminar: el almacén tiene movimientos, stock o ventas asociadas. Edítalo y desactívalo en su lugar."
        : error.message;
      await confirm({
        title: "No se pudo eliminar",
        description: msg,
        confirmText: "Entendido",
        cancelText: "Cerrar",
      });
    } else { toast.success("Eliminado"); load(); reload(); }
  };

  return (
    <>
      {dialog}
      <PageHeader
        title="Almacenes"
        description="Sucursales y puntos de almacenamiento"
        actions={isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditing({ nombre: "", direccion: "", activo: true })}>
                <Plus className="mr-2 h-4 w-4" />Nuevo
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editing.id ? "Editar" : "Nuevo"} almacén</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Nombre</Label>
                  <Input value={editing.nombre || ""} onChange={(e) => setEditing({ ...editing, nombre: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Dirección</Label>
                  <Input value={editing.direccion || ""} onChange={(e) => setEditing({ ...editing, direccion: e.target.value })} />
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
              <TableRow><TableHead>Nombre</TableHead><TableHead>Dirección</TableHead><TableHead></TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {list.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.nombre}</TableCell>
                  <TableCell className="text-muted-foreground">{a.direccion || "—"}</TableCell>
                  <TableCell className="text-right">
                    {isAdmin && (
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => { setEditing(a); setOpen(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => remove(a)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {list.length === 0 && (
                <TableRow><TableCell colSpan={3} className="py-8 text-center text-sm text-muted-foreground">Sin almacenes</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
