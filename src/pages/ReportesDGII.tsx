import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { format, startOfMonth } from "date-fns";

function descargar(nombre: string, contenido: string) {
  const blob = new Blob([contenido], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nombre; a.click();
  URL.revokeObjectURL(url);
}

const fmtFecha = (d: string) => d.slice(0, 10).replace(/-/g, "");
const fmtMonto = (n: number) => Number(n || 0).toFixed(2);

export default function ReportesDGII() {
  const { tenant } = useAuth();
  const hoy = format(new Date(), "yyyy-MM-dd");
  const inicioMes = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const [desde, setDesde] = useState(inicioMes);
  const [hasta, setHasta] = useState(hoy);
  const [loading, setLoading] = useState(false);

  const generar607 = async () => {
    if (!tenant) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("facturas")
      .select("ncf, ncf_tipo, fecha_emision, total, impuesto, subtotal, datos_cliente")
      .eq("tenant_id", tenant.id)
      .not("ncf", "is", null)
      .gte("fecha_emision", new Date(desde).toISOString())
      .lte("fecha_emision", new Date(hasta + "T23:59:59").toISOString())
      .neq("estado", "anulada");
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    if (!data?.length) { toast.error("Sin facturas con NCF en el período"); return; }

    // Formato 607 simplificado pipe-delimited
    const header = "RNC|TipoIdentificacion|NCF|FechaComprobante|MontoFacturado|ITBIS";
    const lines = data.map((f: any) => {
      const cli = f.datos_cliente || {};
      const rnc = (cli.identificador_fiscal || "").replace(/\D/g, "");
      const tipoId = rnc.length === 9 ? "1" : rnc.length === 11 ? "2" : "0";
      return [rnc || "00000000000", tipoId, f.ncf, fmtFecha(f.fecha_emision), fmtMonto(f.total), fmtMonto(f.impuesto)].join("|");
    });
    descargar(`607_${desde}_${hasta}.txt`, [header, ...lines].join("\n"));
    toast.success(`607 generado: ${data.length} registros`);
  };

  const generar606 = async () => {
    if (!tenant) return;
    setLoading(true);
    const { data: oc } = await (supabase as any).from("ordenes_compra")
      .select("ncf, fecha, total, impuesto, subtotal, proveedores:proveedor_id(identificador_fiscal,nombre)")
      .eq("tenant_id", tenant.id)
      .not("ncf", "is", null)
      .gte("fecha", desde).lte("fecha", hasta);
    const { data: gastos } = await supabase.from("gastos")
      .select("monto, fecha, concepto, proveedores:proveedor_id(identificador_fiscal,nombre)")
      .eq("tenant_id", tenant.id)
      .gte("fecha", desde).lte("fecha", hasta);
    setLoading(false);

    const filas: string[] = [];
    (oc || []).forEach((o: any) => {
      const rnc = (o.proveedores?.identificador_fiscal || "").replace(/\D/g, "");
      filas.push([rnc, o.ncf, o.fecha.replace(/-/g,""), fmtMonto(o.total), fmtMonto(o.impuesto)].join("|"));
    });
    (gastos || []).forEach((g: any) => {
      const rnc = (g.proveedores?.identificador_fiscal || "").replace(/\D/g, "");
      if (!rnc) return;
      filas.push([rnc, "", g.fecha.replace(/-/g,""), fmtMonto(Number(g.monto)), "0.00"].join("|"));
    });
    if (!filas.length) { toast.error("Sin compras/gastos en el período"); return; }
    const header = "RNC|NCF|Fecha|Monto|ITBIS";
    descargar(`606_${desde}_${hasta}.txt`, [header, ...filas].join("\n"));
    toast.success(`606 generado: ${filas.length} registros`);
  };

  return (
    <>
      <PageHeader title="Reportes DGII" description="Exportar formatos 606 (compras) y 607 (ventas)" />
      <Card className="shadow-soft mb-4">
        <CardHeader><CardTitle className="text-base">Período</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 max-w-md">
          <div className="space-y-1.5"><Label>Desde</Label><Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Hasta</Label><Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></div>
        </CardContent>
      </Card>

      <Tabs defaultValue="607">
        <TabsList>
          <TabsTrigger value="607">607 - Ventas</TabsTrigger>
          <TabsTrigger value="606">606 - Compras</TabsTrigger>
        </TabsList>
        <TabsContent value="607" className="mt-4">
          <Card className="shadow-soft"><CardContent className="p-6 space-y-3">
            <p className="text-sm text-muted-foreground">Reporte de ventas y operaciones realizadas con NCF en el período.</p>
            <Button disabled={loading} onClick={generar607}><Download className="h-4 w-4 mr-2" />Descargar 607 (TXT)</Button>
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="606" className="mt-4">
          <Card className="shadow-soft"><CardContent className="p-6 space-y-3">
            <p className="text-sm text-muted-foreground">Reporte de compras de bienes y servicios (órdenes de compra y gastos con RNC).</p>
            <Button disabled={loading} onClick={generar606}><Download className="h-4 w-4 mr-2" />Descargar 606 (TXT)</Button>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
