import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { NumberInput } from "@/components/ui/number-input";
import { formatCurrency, formatDate } from "@/lib/format";
import { subDays } from "date-fns";
import { Wallet, FileDown } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function CuadrePersonal() {
  const { tenant } = useAuth();
  const [periodo, setPeriodo] = useState<7 | 15 | 30>(7);
  const [pct, setPct] = useState<number>(20);
  const [ventas, setVentas] = useState<any[]>([]);
  const moneda = tenant?.moneda || "USD";

  useEffect(() => {
    if (!tenant) return;
    (async () => {
      const desde = subDays(new Date(), periodo).toISOString();
      const { data } = await supabase
        .from("ventas")
        .select("id, numero, total, created_at, clientes(nombre), facturas(numero_factura)")
        .eq("estado", "completada")
        .gte("created_at", desde)
        .order("created_at", { ascending: false });
      setVentas(data || []);
    })();
  }, [tenant, periodo]);

  const ingresos = ventas.reduce((s, v) => s + Number(v.total), 0);
  const retiro = ingresos * (pct / 100);
  const restante = ingresos - retiro;

  const exportarCSV = () => {
    const rows = [["Fecha", "Factura/Venta", "Cliente", "Total"]];
    ventas.forEach((v) => {
      const num = (v.facturas as any)?.[0]?.numero_factura || `Venta #${v.numero}`;
      rows.push([new Date(v.created_at).toLocaleDateString(), num, v.clientes?.nombre || "Ocasional", String(v.total)]);
    });
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `cuadre-${periodo}d.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const exportarPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text("Cuadre Personal", 14, 18);
    doc.setFontSize(10);
    doc.text(`Período: últimos ${periodo} días`, 14, 26);
    doc.text(`Ingresos: ${formatCurrency(ingresos, moneda)}`, 14, 32);
    doc.text(`Retiro (${pct}%): ${formatCurrency(retiro, moneda)}`, 14, 38);
    doc.text(`Queda en caja: ${formatCurrency(restante, moneda)}`, 14, 44);
    autoTable(doc, {
      startY: 50,
      head: [["Fecha", "Factura/Venta", "Cliente", "Total"]],
      body: ventas.map((v) => {
        const num = (v.facturas as any)?.[0]?.numero_factura || `#${v.numero}`;
        return [new Date(v.created_at).toLocaleDateString(), num, v.clientes?.nombre || "Ocasional", formatCurrency(v.total, moneda)];
      }),
    });
    doc.save(`cuadre-${periodo}d.pdf`);
  };

  return (
    <>
      <PageHeader title="Cuadre Personal" description="Calcula tu retiro y lo que queda en caja" />

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Wallet className="h-4 w-4" />Calculadora</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Período</Label>
              <div className="inline-flex rounded-md border bg-muted/30 p-0.5">
                {[7, 15, 30].map((d) => (
                  <Button key={d} size="sm" variant={periodo === d ? "default" : "ghost"} onClick={() => setPeriodo(d as any)}>
                    {d} días
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-1 w-40">
              <Label className="text-xs">% a retirar</Label>
              <NumberInput value={pct} onChange={setPct} min={0} max={100} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border bg-card p-4">
              <div className="text-xs uppercase text-muted-foreground">Ingresos del período</div>
              <div className="mt-2 text-2xl font-semibold">{formatCurrency(ingresos, moneda)}</div>
              <div className="mt-1 text-xs text-muted-foreground">{ventas.length} venta(s)</div>
            </div>
            <div className="rounded-lg border bg-success/5 p-4">
              <div className="text-xs uppercase text-success">Monto a retirar</div>
              <div className="mt-2 text-2xl font-semibold text-success">{formatCurrency(retiro, moneda)}</div>
              <div className="mt-1 text-xs text-muted-foreground">{pct}% de los ingresos</div>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <div className="text-xs uppercase text-muted-foreground">Queda en caja</div>
              <div className="mt-2 text-2xl font-semibold">{formatCurrency(restante, moneda)}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4 shadow-soft">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Ventas del período</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={exportarCSV}><FileDown className="mr-1 h-3 w-3" />CSV</Button>
            <Button size="sm" variant="outline" onClick={exportarPDF}><FileDown className="mr-1 h-3 w-3" />PDF</Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Factura / Venta</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ventas.map((v) => {
                const num = (v.facturas as any)?.[0]?.numero_factura || `#${v.numero}`;
                return (
                  <TableRow key={v.id}>
                    <TableCell className="text-xs">{formatDate(v.created_at)}</TableCell>
                    <TableCell className="font-mono text-xs">{num}</TableCell>
                    <TableCell>{v.clientes?.nombre || "Cliente ocasional"}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(v.total, moneda)}</TableCell>
                  </TableRow>
                );
              })}
              {ventas.length === 0 && (
                <TableRow><TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">Sin ventas en el período</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
