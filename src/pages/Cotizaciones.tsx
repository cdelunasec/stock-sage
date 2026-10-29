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
import { Plus, Eye } from "lucide-react";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { toast } from "sonner";

const estadoVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  borrador: "outline",
  enviada: "secondary",
  aceptada: "default",
  convertida: "default",
  rechazada: "destructive",
  vencida: "destructive",
};

export default function Cotizaciones() {
  const navigate = useNavigate();
  const { tenant } = useAuth();
  const { almacenActivo } = useAlmacen();
  const [rows, setRows] = useState<any[]>([]);

  const load = async () => {
    const { data } = await (supabase as any)
      .from("cotizaciones")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    const rows = data || [];
    const cliIds = Array.from(new Set(rows.filter((r: any) => r.cliente_id).map((r: any) => r.cliente_id)));
    const almIds = Array.from(new Set(rows.map((r: any) => r.almacen_id).filter(Boolean)));
    const [{ data: cli }, { data: alm }] = await Promise.all([
      cliIds.length ? supabase.from("clientes").select("id, nombre").in("id", cliIds as string[]) : Promise.resolve({ data: [] as any[] }),
      almIds.length ? supabase.from("almacenes").select("id, nombre").in("id", almIds as string[]) : Promise.resolve({ data: [] as any[] }),
    ]);
    const cMap = new Map((cli || []).map((c: any) => [c.id, c]));
    const aMap = new Map((alm || []).map((a: any) => [a.id, a]));
    setRows(rows.map((r: any) => ({
      ...r,
      clientes: r.cliente_id ? cMap.get(r.cliente_id) : null,
      almacenes: aMap.get(r.almacen_id) || null,
    })));
  };
  useEffect(() => { if (tenant) load(); }, [tenant]);

  return (
    <>
      <PageHeader
        title="Cotizaciones"
        description="Presupuestos sin afectar stock ni ingresos"
        actions={
          <Button onClick={() => {
            if (!almacenActivo) { toast.error("Selecciona un almacén"); return; }
            navigate("/cotizaciones/nueva");
          }}>
            <Plus className="mr-2 h-4 w-4" />Nueva cotización
          </Button>
        }
      />

      <Card className="shadow-soft">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Almacén</TableHead>
                <TableHead>Válida hasta</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => {
                const vencida = c.valida_hasta && new Date(c.valida_hasta) < new Date()
                  && !["aceptada", "convertida", "rechazada"].includes(c.estado);
                const estado = vencida ? "vencida" : c.estado;
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs">#{c.numero}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDateTime(c.created_at)}</TableCell>
                    <TableCell>{c.clientes?.nombre || "Cliente ocasional"}</TableCell>
                    <TableCell>{c.almacenes?.nombre}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.valida_hasta ? new Date(c.valida_hasta).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={estadoVariant[estado] || "secondary"}>{estado}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(c.total, tenant?.moneda)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => navigate(`/cotizaciones/${c.id}`)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">Sin cotizaciones</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
