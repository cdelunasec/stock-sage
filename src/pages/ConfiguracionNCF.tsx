import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const TIPOS = ["B01", "B02", "B14", "B15"] as const;

export default function ConfiguracionNCF() {
  const { tenant } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ tipo: "B02", prefijo: "B02", desde: 1, hasta: 1000, vencimiento: "" });

  const load = async () => {
    const { data } = await (supabase as any).from("ncf_secuencias").select("*").order("tipo");
    setRows(data || []);
  };
  useEffect(() => { if (tenant) load(); }, [tenant]);

  const guardar = async () => {
    if (!f.prefijo || f.desde <= 0 || f.hasta < f.desde) { toast.error("Datos inválidos"); return; }
    const { error } = await (supabase as any).from("ncf_secuencias").insert({
      tenant_id: tenant!.id,
      tipo: f.tipo,
      prefijo: f.prefijo,
      secuencia_desde: f.desde,
      secuencia_hasta: f.hasta,
      secuencia_actual: f.desde,
      fecha_vencimiento: f.vencimiento || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Secuencia agregada"); setOpen(false); load();
  };

  const eliminar = async (id: string) => {
    const { error } = await (supabase as any).from("ncf_secuencias").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Eliminada"); load();
  };

  return (
    <>
      <PageHeader title="Secuencias NCF (DGII)" description="Rangos autorizados por la DGII para emitir comprobantes" />
      <Card className="shadow-soft">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Secuencias autorizadas</CardTitle>
          <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />Nueva secuencia</Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Tipo</TableHead><TableHead>Prefijo</TableHead>
              <TableHead>Desde</TableHead><TableHead>Hasta</TableHead>
              <TableHead>Actual</TableHead><TableHead>Vence</TableHead>
              <TableHead>Estado</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rows.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Sin secuencias configuradas</TableCell></TableRow>}
              {rows.map((r) => {
                const agotada = r.secuencia_actual > r.secuencia_hasta;
                const vencida = r.fecha_vencimiento && r.fecha_vencimiento < new Date().toISOString().slice(0,10);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.tipo}</TableCell>
                    <TableCell>{r.prefijo}</TableCell>
                    <TableCell>{r.secuencia_desde}</TableCell>
                    <TableCell>{r.secuencia_hasta}</TableCell>
                    <TableCell>{r.secuencia_actual}</TableCell>
                    <TableCell>{r.fecha_vencimiento || "—"}</TableCell>
                    <TableCell>
                      {agotada ? <Badge variant="destructive">Agotada</Badge>
                        : vencida ? <Badge variant="destructive">Vencida</Badge>
                        : <Badge>Activa</Badge>}
                    </TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" onClick={() => eliminar(r.id)}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nueva secuencia NCF</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={f.tipo} onValueChange={(v) => setF({ ...f, tipo: v, prefijo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Prefijo</Label><Input value={f.prefijo} onChange={(e) => setF({ ...f, prefijo: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Desde</Label><Input type="number" value={f.desde} onChange={(e) => setF({ ...f, desde: Number(e.target.value) })} /></div>
              <div className="space-y-1.5"><Label>Hasta</Label><Input type="number" value={f.hasta} onChange={(e) => setF({ ...f, hasta: Number(e.target.value) })} /></div>
            </div>
            <div className="space-y-1.5"><Label>Fecha vencimiento (opcional)</Label><Input type="date" value={f.vencimiento} onChange={(e) => setF({ ...f, vencimiento: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={guardar}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
