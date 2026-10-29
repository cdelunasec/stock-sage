import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatNumber } from "@/lib/format";
import { AlertTriangle, TrendingUp, DollarSign, Receipt, X } from "lucide-react";
import { format, subDays, startOfMonth } from "date-fns";

interface GananciasData {
  ingresos: number;
  costo: number;
  ganancia: number;
  ventas: number;
  margenPct: number;
}

export default function Reportes() {
  const { tenant } = useAuth();
  const [bajos, setBajos] = useState<any[]>([]);
  const [topVendidos, setTopVendidos] = useState<any[]>([]);
  const [valoracion, setValoracion] = useState<any[]>([]);

  // Ganancias — por defecto: últimos 30 días
  const hoy = format(new Date(), "yyyy-MM-dd");
  const hace30 = format(subDays(new Date(), 30), "yyyy-MM-dd");
  const [desde, setDesde] = useState<string>(hace30);
  const [hasta, setHasta] = useState<string>(hoy);
  const [ganancias, setGanancias] = useState<GananciasData>({
    ingresos: 0, costo: 0, ganancia: 0, ventas: 0, margenPct: 0,
  });

  const cargarGanancias = async () => {
    if (!tenant) return;
    const desdeIso = new Date(desde).toISOString();
    const hastaDate = new Date(hasta);
    hastaDate.setHours(23, 59, 59, 999);
    const hastaIso = hastaDate.toISOString();

    const { data: ventas } = await supabase
      .from("ventas")
      .select("id, total")
      .eq("estado", "completada")
      .gte("created_at", desdeIso)
      .lte("created_at", hastaIso);

    const ventaIds = (ventas || []).map((v) => v.id);
    let costoTotal = 0;

    if (ventaIds.length > 0) {
      const { data: items } = await supabase
        .from("venta_items")
        .select("cantidad, producto_id, productos(precio_costo)")
        .in("venta_id", ventaIds);
      (items || []).forEach((it: any) => {
        if (it.producto_id && it.productos?.precio_costo != null) {
          costoTotal += Number(it.cantidad) * Number(it.productos.precio_costo);
        }
        // servicios no suman costo
      });
    }

    const ingresos = (ventas || []).reduce((s, v) => s + Number(v.total), 0);
    const ganancia = ingresos - costoTotal;
    const margenPct = ingresos > 0 ? (ganancia / ingresos) * 100 : 0;

    setGanancias({
      ingresos,
      costo: costoTotal,
      ganancia,
      ventas: ventas?.length || 0,
      margenPct,
    });
  };

  useEffect(() => {
    if (!tenant) return;
    cargarGanancias();
  }, [tenant, desde, hasta]);

  useEffect(() => {
    if (!tenant) return;
    (async () => {
      const { data: prod } = await supabase.from("productos").select("id, nombre, sku, stock_minimo, precio_costo, unidad");
      const { data: stock } = await supabase.from("stock_levels").select("producto_id, cantidad");
      const stockMap = new Map<string, number>();
      (stock || []).forEach((s) => stockMap.set(s.producto_id, (stockMap.get(s.producto_id) || 0) + Number(s.cantidad)));

      const lows = (prod || [])
        .map((p) => ({ ...p, stock: stockMap.get(p.id) || 0 }))
        .filter((p) => p.stock_minimo > 0 && p.stock <= p.stock_minimo);
      setBajos(lows);

      const val = (prod || [])
        .map((p) => ({ ...p, stock: stockMap.get(p.id) || 0, valor: (stockMap.get(p.id) || 0) * Number(p.precio_costo) }))
        .sort((a, b) => b.valor - a.valor)
        .slice(0, 10);
      setValoracion(val);

      const { data: items } = await supabase
        .from("venta_items").select("cantidad, productos(nombre, sku), ventas!inner(estado)")
        .eq("ventas.estado", "completada");
      const map = new Map<string, { nombre: string; sku: string; cantidad: number }>();
      (items || []).forEach((it: any) => {
        const k = it.productos?.sku || "—";
        const cur = map.get(k) || { nombre: it.productos?.nombre, sku: k, cantidad: 0 };
        cur.cantidad += Number(it.cantidad);
        map.set(k, cur);
      });
      setTopVendidos(Array.from(map.values()).sort((a, b) => b.cantidad - a.cantidad).slice(0, 10));
    })();
  }, [tenant]);

  const moneda = tenant?.moneda || "USD";

  const presets = [
    { label: "Mes actual", days: -1 },
    { label: "Hoy", days: 0 },
    { label: "7 días", days: 7 },
    { label: "30 días", days: 30 },
    { label: "90 días", days: 90 },
  ];
  const aplicarPreset = (days: number) => {
    if (days === -1) {
      setDesde(format(startOfMonth(new Date()), "yyyy-MM-dd"));
    } else {
      setDesde(format(subDays(new Date(), days), "yyyy-MM-dd"));
    }
    setHasta(hoy);
  };

  return (
    <>
      <PageHeader title="Reportes" description="Análisis del inventario y ganancias" />

      {/* Ganancias */}
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-success" />
            Ganancias
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Desde</Label>
              <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="w-[160px]" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Hasta</Label>
              <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="w-[160px]" />
            </div>
            <div className="flex flex-wrap gap-1">
              {presets.map((p) => (
                <Button key={p.label} size="sm" variant="outline" onClick={() => aplicarPreset(p.days)}>
                  {p.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
                <DollarSign className="h-3 w-3" /> Ingresos
              </div>
              <div className="mt-2 text-2xl font-semibold">{formatCurrency(ganancias.ingresos, moneda)}</div>
              <div className="mt-1 text-xs text-muted-foreground">{ganancias.ventas} venta(s)</div>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
                <Receipt className="h-3 w-3" /> Costo de mercancía
              </div>
              <div className="mt-2 text-2xl font-semibold">{formatCurrency(ganancias.costo, moneda)}</div>
              <div className="mt-1 text-xs text-muted-foreground">Servicios sin costo</div>
            </div>
            <div className="rounded-lg border bg-success/5 p-4">
              <div className="flex items-center gap-2 text-xs uppercase text-success">
                <TrendingUp className="h-3 w-3" /> Ganancia neta
              </div>
              <div className="mt-2 text-2xl font-semibold text-success">{formatCurrency(ganancias.ganancia, moneda)}</div>
              <div className="mt-1 text-xs text-muted-foreground">Ingresos − Costo</div>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
                Margen
              </div>
              <div className="mt-2 text-2xl font-semibold">{ganancias.margenPct.toFixed(1)}%</div>
              <div className="mt-1 text-xs text-muted-foreground">Ganancia / Ingresos</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="shadow-soft">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4 text-warning" />Bajo stock</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Producto</TableHead><TableHead className="text-right">Stock</TableHead><TableHead className="text-right">Mínimo</TableHead></TableRow></TableHeader>
              <TableBody>
                {bajos.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell><div className="font-medium">{p.nombre}</div><div className="text-xs text-muted-foreground">{p.sku}</div></TableCell>
                    <TableCell className="text-right">{formatNumber(p.stock, 0)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatNumber(p.stock_minimo, 0)}</TableCell>
                  </TableRow>
                ))}
                {bajos.length === 0 && <TableRow><TableCell colSpan={3} className="py-6 text-center text-sm text-muted-foreground">Sin alertas</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader><CardTitle className="text-base">Top productos vendidos</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Producto</TableHead><TableHead className="text-right">Unidades</TableHead></TableRow></TableHeader>
              <TableBody>
                {topVendidos.map((p) => (
                  <TableRow key={p.sku}>
                    <TableCell><div className="font-medium">{p.nombre}</div><div className="text-xs text-muted-foreground">{p.sku}</div></TableCell>
                    <TableCell className="text-right">{formatNumber(p.cantidad, 0)}</TableCell>
                  </TableRow>
                ))}
                {topVendidos.length === 0 && <TableRow><TableCell colSpan={2} className="py-6 text-center text-sm text-muted-foreground">Sin datos</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4 shadow-soft">
        <CardHeader><CardTitle className="text-base">Valoración de inventario (top 10)</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Costo unitario</TableHead>
                <TableHead className="text-right">Valor total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {valoracion.map((p) => (
                <TableRow key={p.id}>
                  <TableCell><div className="font-medium">{p.nombre}</div><div className="text-xs text-muted-foreground">{p.sku}</div></TableCell>
                  <TableCell className="text-right">{formatNumber(p.stock, 0)} {p.unidad}</TableCell>
                  <TableCell className="text-right">{formatCurrency(p.precio_costo, tenant?.moneda)}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(p.valor, tenant?.moneda)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
