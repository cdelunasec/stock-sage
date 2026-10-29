import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAlmacen } from "@/contexts/AlmacenContext";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Eye, RotateCcw, Trash2 } from "lucide-react";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { toast } from "sonner";
import { useConfirm } from "@/components/ConfirmDialog";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { logAudit } from "@/lib/audit";

export default function Ventas() {
  const navigate = useNavigate();
  const { tenant, canManage, isAdmin, isSuperadmin, user } = useAuth();
  const { confirm, dialog } = useConfirm();
  const { almacenActivo } = useAlmacen();
  const [ventas, setVentas] = useState<any[]>([]);
  const [delTarget, setDelTarget] = useState<any | null>(null);
  const [delMotivo, setDelMotivo] = useState("");
  const [delDevolver, setDelDevolver] = useState(true);
  const [delLoading, setDelLoading] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("ventas")
      .select("*, clientes(nombre), almacenes(nombre)")
      .order("created_at", { ascending: false }).limit(100);
    setVentas(data || []);
  };
  useEffect(() => { if (tenant) load(); }, [tenant]);

  const devolver = async (venta: any) => {
    if (!canManage) return;
    const ok = await confirm({
      title: "¿Procesar devolución?",
      description: `Se devolverá la venta #${venta.numero} y el stock de los productos se reingresará al almacén.`,
      confirmText: "Procesar devolución",
    });
    if (!ok) return;
    const { data: items } = await supabase.from("venta_items").select("*").eq("venta_id", venta.id);
    if (!items || items.length === 0) return;
    const moves = items
      .filter((it: any) => it.producto_id) // solo productos generan movimiento de stock
      .map((it: any) => ({
      tenant_id: tenant!.id,
      producto_id: it.producto_id,
      almacen_id: venta.almacen_id,
      tipo: "devolucion" as const,
      cantidad: it.cantidad,
      referencia: `Devolución venta #${venta.numero}`,
      user_id: user?.id,
    }));
    if (moves.length > 0) {
      const { error: e1 } = await supabase.from("stock_movements").insert(moves);
      if (e1) { toast.error(e1.message); return; }
    }
    const { error: e2 } = await supabase.from("ventas").update({ estado: "devuelta" }).eq("id", venta.id);
    if (e2) toast.error(e2.message);
    else { toast.success("Devolución procesada"); load(); }
  };

  const abrirEliminar = (v: any) => {
    setDelTarget(v);
    setDelMotivo("");
    setDelDevolver(true);
  };

  const confirmarEliminar = async () => {
    if (!delTarget) return;
    if (!delMotivo.trim()) { toast.error("Indica el motivo de la eliminación"); return; }
    setDelLoading(true);
    const { error } = await supabase.rpc("eliminar_venta", {
      _venta_id: delTarget.id,
      _motivo: delMotivo.trim(),
      _devolver_stock: delDevolver,
    });
    setDelLoading(false);
    if (error) { toast.error(error.message); return; }
    await logAudit("venta_eliminada", "venta", delTarget.id, {
      numero: delTarget.numero, motivo: delMotivo.trim(), devolver_stock: delDevolver,
    });
    toast.success("Venta eliminada");
    setDelTarget(null);
    load();
  };

  return (
    <>
      {dialog}
      <PageHeader
        title="Ventas"
        description="Historial y nueva venta"
        actions={
          <Button onClick={() => {
            if (!almacenActivo) { toast.error("Selecciona un almacén"); return; }
            navigate("/ventas/nueva");
          }}>
            <Plus className="mr-2 h-4 w-4" />Nueva venta
          </Button>
        }
      />

      <Card className="shadow-soft">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Atendido por</TableHead>
                <TableHead>Almacén</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TooltipProvider delayDuration={150}>
              {ventas.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-mono text-xs">#{v.numero}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDateTime(v.created_at)}</TableCell>
                  <TableCell>{v.clientes?.nombre || "Cliente ocasional"}</TableCell>
                  <TableCell>
                    {(isAdmin || isSuperadmin) && v.created_by_email ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help underline decoration-dotted">
                            {v.atendido_por_nombre || "—"}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="text-xs">
                            <div className="font-semibold">Cuenta real</div>
                            <div>{v.created_by_email}</div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span>{v.atendido_por_nombre || "—"}</span>
                    )}
                  </TableCell>
                  <TableCell>{v.almacenes?.nombre}</TableCell>
                  <TableCell>
                    <Badge variant={
                      v.estado === "completada" ? "default"
                      : v.estado === "devuelta" ? "secondary"
                      : v.estado === "eliminada" ? "outline"
                      : "destructive"
                    }>
                      {v.estado === "eliminada" ? "Venta eliminada" : v.estado}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(v.total, tenant?.moneda)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => navigate(`/ventas/${v.id}`)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {canManage && v.estado === "completada" && (
                        <Button size="icon" variant="ghost" onClick={() => devolver(v)} title="Procesar devolución">
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      )}
                      {isAdmin && v.estado !== "eliminada" && (
                        <Button size="icon" variant="ghost" onClick={() => abrirEliminar(v)} title="Eliminar venta">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              </TooltipProvider>
              {ventas.length === 0 && (
                <TableRow><TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">Sin ventas</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!delTarget} onOpenChange={(o) => !o && setDelTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar venta #{delTarget?.numero}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              La venta se marcará como <strong>"Venta eliminada"</strong> conservando todos sus datos en el historial.
            </p>
            <div className="space-y-2">
              <Label>Motivo *</Label>
              <Textarea
                placeholder="Ej: error de digitación, devolución del cliente, anulación..."
                value={delMotivo}
                onChange={(e) => setDelMotivo(e.target.value)}
              />
            </div>
            {delTarget?.estado === "completada" && (
              <label className="flex items-start gap-2 rounded-md border bg-muted/30 p-3 text-sm cursor-pointer">
                <Checkbox
                  checked={delDevolver}
                  onCheckedChange={(v) => setDelDevolver(!!v)}
                  className="mt-0.5"
                />
                <span>
                  <strong>Reintegrar productos al inventario</strong>
                  <span className="block text-xs text-muted-foreground">
                    Marca esto si el motivo es una devolución; las unidades volverán al almacén.
                  </span>
                </span>
              </label>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDelTarget(null)} disabled={delLoading}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmarEliminar} disabled={delLoading}>
              {delLoading ? "Eliminando..." : "Eliminar venta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
