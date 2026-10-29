import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
import { formatCurrency } from "@/lib/format";
import { useConfirm } from "@/components/ConfirmDialog";

interface Cliente {
  id: string; nombre: string; identificador_fiscal: string | null; email: string | null;
  telefono: string | null; direccion: string | null; credito_disponible: number;
}
const empty: Partial<Cliente> = { nombre: "", credito_disponible: 0 };

export default function Clientes() {
  const { tenant } = useAuth();
  const { confirm, dialog } = useConfirm();
  const [list, setList] = useState<Cliente[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Cliente>>(empty);

  const load = async () => {
    const { data } = await supabase.from("clientes").select("*").order("nombre");
    setList((data || []) as Cliente[]);
  };
  useEffect(() => { if (tenant) load(); }, [tenant]);

  const save = async () => {
    if (!editing.nombre) { toast.error("Nombre obligatorio"); return; }
    const payload: any = { ...editing, tenant_id: tenant!.id };
    delete payload.id;
    const { error } = editing.id
      ? await supabase.from("clientes").update(payload).eq("id", editing.id)
      : await supabase.from("clientes").insert(payload);
    if (error) toast.error(error.message);
    else { toast.success("Guardado"); setOpen(false); setEditing(empty); load(); }
  };

  const remove = async (c: Cliente) => {
    const ok = await confirm({
      title: "¿Eliminar cliente?",
      description: `Se eliminará "${c.nombre}".`,
      variant: "destructive", confirmText: "Eliminar",
    });
    if (!ok) return;
    const { error } = await supabase.from("clientes").delete().eq("id", c.id);
    if (error) toast.error(error.message);
    else { toast.success("Eliminado"); load(); }
  };

  return (
    <>
      {dialog}
      <PageHeader
        title="Clientes"
        description="Cartera de clientes"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditing(empty)}><Plus className="mr-2 h-4 w-4" />Nuevo</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editing.id ? "Editar" : "Nuevo"} cliente</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label>Nombre *</Label>
                  <Input value={editing.nombre || ""} onChange={(e) => setEditing({ ...editing, nombre: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>ID fiscal</Label>
                  <Input value={editing.identificador_fiscal || ""} onChange={(e) => setEditing({ ...editing, identificador_fiscal: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Teléfono</Label>
                  <Input value={editing.telefono || ""} onChange={(e) => setEditing({ ...editing, telefono: e.target.value })} />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={editing.email || ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Dirección</Label>
                  <Input value={editing.direccion || ""} onChange={(e) => setEditing({ ...editing, direccion: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Crédito disponible</Label>
                  <Input type="number" step="0.01" value={editing.credito_disponible ?? 0} onChange={(e) => setEditing({ ...editing, credito_disponible: Number(e.target.value) })} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={save}>Guardar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <Card className="shadow-soft">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead className="text-right">Crédito</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.nombre}</TableCell>
                  <TableCell className="text-muted-foreground">{c.email || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{c.telefono || "—"}</TableCell>
                  <TableCell className="text-right">{formatCurrency(c.credito_disponible, tenant?.moneda)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(c); setOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(c)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {list.length === 0 && (
                <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">Sin clientes</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
