import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/format";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FileText, Search } from "lucide-react";

export default function Facturas() {
  const { tenant, isAdmin, isSuperadmin } = useAuth();
  const [facturas, setFacturas] = useState<any[]>([]);
  const [busq, setBusq] = useState("");
  const [estado, setEstado] = useState("__all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenant) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("facturas")
        .select("*, clientes(nombre)")
        .neq("estado", "eliminada")
        .order("fecha_emision", { ascending: false });
      setFacturas(data || []);
      setLoading(false);
    })();
  }, [tenant]);

  const filtradas = facturas.filter((f) => {
    if (estado !== "__all" && f.estado !== estado) return false;
    if (busq && !f.numero_factura.toLowerCase().includes(busq.toLowerCase())
        && !(f.clientes?.nombre || "").toLowerCase().includes(busq.toLowerCase())) return false;
    return true;
  });

  const variant = (e: string) =>
    e === "pagada" ? "default" : e === "anulada" ? "destructive" : "secondary";

  return (
    <>
      <PageHeader title="Facturación" description="Listado de facturas emitidas" />

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por número o cliente"
                 value={busq} onChange={(e) => setBusq(e.target.value)} />
        </div>
        <Select value={estado} onValueChange={setEstado}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">Todos los estados</SelectItem>
            <SelectItem value="emitida">Emitida</SelectItem>
            <SelectItem value="pagada">Pagada</SelectItem>
            <SelectItem value="anulada">Anulada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="shadow-soft">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N°</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Atendido por</TableHead>
                <TableHead>Condición</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={7} className="py-6 text-center text-sm text-muted-foreground">Cargando…</TableCell></TableRow>}
              {!loading && filtradas.length === 0 && (
                <TableRow><TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  <FileText className="mx-auto mb-2 h-8 w-8 opacity-40" />Sin facturas
                </TableCell></TableRow>
              )}
              <TooltipProvider delayDuration={150}>
              {filtradas.map((f) => (
                <TableRow key={f.id} className="cursor-pointer hover:bg-muted/40">
                  <TableCell>
                    <Link to={`/facturas/${f.id}`} className="font-medium text-primary">
                      {f.numero_factura}
                    </Link>
                  </TableCell>
                  <TableCell>{new Date(f.fecha_emision).toLocaleDateString()}</TableCell>
                  <TableCell>{f.clientes?.nombre || "Cliente ocasional"}</TableCell>
                  <TableCell>
                    {(isAdmin || isSuperadmin) && f.created_by_email ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help underline decoration-dotted">
                            {f.atendido_por_nombre || "—"}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="text-xs">
                            <div className="font-semibold">Cuenta real</div>
                            <div>{f.created_by_email}</div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span>{f.atendido_por_nombre || "—"}</span>
                    )}
                  </TableCell>
                  <TableCell className="capitalize">{f.condicion_pago}</TableCell>
                  <TableCell><Badge variant={variant(f.estado) as any} className="capitalize">{f.estado}</Badge></TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(Number(f.total), tenant?.moneda)}</TableCell>
                </TableRow>
              ))}
              </TooltipProvider>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
