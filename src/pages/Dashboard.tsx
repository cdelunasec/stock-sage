import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAlmacen } from "@/contexts/AlmacenContext";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UpgradePlanCard } from "@/components/UpgradePlanCard";
import { Package, AlertTriangle, ShoppingCart, DollarSign, Plus, PackagePlus, Boxes, UserPlus } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Legend,
} from "recharts";
import { format, subDays, startOfMonth } from "date-fns";
import { es } from "date-fns/locale";

interface KPI {
  valorInventario: number;
  bajoStock: number;
  ventasMes: number;
  totalProductos: number;
}

export default function Dashboard() {
  const { tenant, isAdmin, canManage } = useAuth();
  const { almacenActivo } = useAlmacen();
  const navigate = useNavigate();
  const [kpi, setKpi] = useState<KPI>({ valorInventario: 0, bajoStock: 0, ventasMes: 0, totalProductos: 0 });
  const [ventasDia, setVentasDia] = useState<{ fecha: string; total: number }[]>([]);
  const [movs, setMovs] = useState<{ fecha: string; entradas: number; salidas: number }[]>([]);
  const [topProductos, setTopProductos] = useState<{ nombre: string; cantidad: number }[]>([]);

  useEffect(() => {
    if (!tenant) return;
    (async () => {
      // Productos + valor de inventario
      const { data: productos } = await supabase.from("productos").select("id, nombre, precio_costo, stock_minimo");
      const { data: stock } = await supabase.from("stock_levels").select("producto_id, cantidad");

      const stockByProd = new Map<string, number>();
      (stock || []).forEach((s) => {
        stockByProd.set(s.producto_id, (stockByProd.get(s.producto_id) || 0) + Number(s.cantidad));
      });

      let valor = 0; let bajos = 0;
      (productos || []).forEach((p) => {
        const qty = stockByProd.get(p.id) || 0;
        valor += qty * Number(p.precio_costo);
        if (qty <= Number(p.stock_minimo) && Number(p.stock_minimo) > 0) bajos++;
      });

      // Ventas del mes
      const inicioMes = startOfMonth(new Date()).toISOString();
      const { data: ventas } = await supabase
        .from("ventas")
        .select("total, created_at")
        .gte("created_at", inicioMes)
        .eq("estado", "completada");

      const ventasMes = (ventas || []).reduce((s, v) => s + Number(v.total), 0);

      setKpi({
        valorInventario: valor,
        bajoStock: bajos,
        ventasMes,
        totalProductos: productos?.length || 0,
      });

      // Ventas últimos 14 días
      const desde = subDays(new Date(), 13);
      const { data: ventas14 } = await supabase
        .from("ventas")
        .select("total, created_at")
        .gte("created_at", desde.toISOString())
        .eq("estado", "completada");

      const ventasMap = new Map<string, number>();
      for (let i = 13; i >= 0; i--) {
        const d = subDays(new Date(), i);
        ventasMap.set(format(d, "yyyy-MM-dd"), 0);
      }
      (ventas14 || []).forEach((v) => {
        const k = format(new Date(v.created_at), "yyyy-MM-dd");
        ventasMap.set(k, (ventasMap.get(k) || 0) + Number(v.total));
      });
      setVentasDia(Array.from(ventasMap.entries()).map(([k, t]) => ({
        fecha: format(new Date(k), "d MMM", { locale: es }), total: Number(t.toFixed(2)),
      })));

      // Movimientos últimos 7 días
      const desdeMov = subDays(new Date(), 6);
      const { data: moves } = await supabase
        .from("stock_movements")
        .select("tipo, cantidad, created_at")
        .gte("created_at", desdeMov.toISOString());

      const movMap = new Map<string, { entradas: number; salidas: number }>();
      for (let i = 6; i >= 0; i--) {
        const d = subDays(new Date(), i);
        movMap.set(format(d, "yyyy-MM-dd"), { entradas: 0, salidas: 0 });
      }
      (moves || []).forEach((m) => {
        const k = format(new Date(m.created_at), "yyyy-MM-dd");
        const cur = movMap.get(k) || { entradas: 0, salidas: 0 };
        if (["entrada", "devolucion"].includes(m.tipo)) cur.entradas += Number(m.cantidad);
        else if (["salida", "venta"].includes(m.tipo)) cur.salidas += Number(m.cantidad);
        movMap.set(k, cur);
      });
      setMovs(Array.from(movMap.entries()).map(([k, v]) => ({
        fecha: format(new Date(k), "d MMM", { locale: es }), ...v,
      })));

      // Top productos del mes
      const { data: items } = await supabase
        .from("venta_items")
        .select("cantidad, productos(nombre), ventas!inner(created_at)")
        .gte("ventas.created_at", inicioMes);
      const topMap = new Map<string, number>();
      (items || []).forEach((it: any) => {
        const n = it.productos?.nombre || "—";
        topMap.set(n, (topMap.get(n) || 0) + Number(it.cantidad));
      });
      setTopProductos(
        Array.from(topMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([nombre, cantidad]) => ({ nombre, cantidad: Number(cantidad) })),
      );
    })();
  }, [tenant]);

  const moneda = tenant?.moneda || "USD";

  const cards = [
    { label: "Valor de inventario", value: formatCurrency(kpi.valorInventario, moneda), icon: DollarSign, color: "text-primary" },
    { label: "Productos", value: kpi.totalProductos.toString(), icon: Package, color: "text-success" },
    { label: "Bajo stock", value: kpi.bajoStock.toString(), icon: AlertTriangle, color: "text-warning" },
    { label: "Ventas del mes", value: formatCurrency(kpi.ventasMes, moneda), icon: ShoppingCart, color: "text-primary" },
  ];

  const quickActions = [
    {
      label: "Nueva venta",
      icon: Plus,
      visible: true, // todos los roles
      onClick: () => {
        if (!almacenActivo) { toast.error("Selecciona un almacén"); return; }
        navigate("/ventas/nueva");
      },
      color: "from-primary/15 to-primary/5 text-primary",
    },
    {
      label: "Agregar producto",
      icon: PackagePlus,
      visible: canManage,
      onClick: () => navigate("/productos?nuevo=1"),
      color: "from-success/15 to-success/5 text-success",
    },
    {
      label: "Ver inventario",
      icon: Boxes,
      visible: true,
      onClick: () => navigate("/stock"),
      color: "from-warning/15 to-warning/5 text-warning",
    },
    {
      label: "Agregar usuario",
      icon: UserPlus,
      visible: isAdmin,
      onClick: () => navigate("/usuarios?nuevo=1"),
      color: "from-accent to-accent/40 text-accent-foreground",
    },
  ].filter((a) => a.visible);

  return (
    <>
      <PageHeader title="Dashboard" description={`Resumen de ${tenant?.nombre || ""}`} />

      <UpgradePlanCard />

      {/* Acciones rápidas */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {quickActions.map((a) => (
          <button
            key={a.label}
            onClick={a.onClick}
            className={`group flex items-center gap-3 rounded-lg border bg-gradient-to-br ${a.color} p-4 text-left shadow-soft transition-all hover:scale-[1.02] hover:shadow-md`}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-background/70 backdrop-blur">
              <a.icon className="h-5 w-5" />
            </div>
            <span className="text-sm font-semibold text-foreground">{a.label}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">

        {cards.map((c) => (
          <Card key={c.label} className="shadow-soft">
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{c.label}</p>
                <p className="mt-2 text-2xl font-semibold">{c.value}</p>
              </div>
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-accent ${c.color}`}>
                <c.icon className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="shadow-soft lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Ventas (últimos 14 días)</CardTitle></CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={ventasDia} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradVentas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="fecha" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Area type="monotone" dataKey="total" stroke="hsl(var(--primary))" fill="url(#gradVentas)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader><CardTitle className="text-base">Top productos (mes)</CardTitle></CardHeader>
          <CardContent>
            {topProductos.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Sin ventas todavía</p>
            ) : (
              <ul className="space-y-3">
                {topProductos.map((p) => (
                  <li key={p.nombre} className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm">{p.nombre}</span>
                    <span className="rounded-md bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">{p.cantidad}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 shadow-soft">
        <CardHeader><CardTitle className="text-base">Movimientos de stock (7 días)</CardTitle></CardHeader>
        <CardContent className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={movs}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="fecha" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Legend />
              <Bar dataKey="entradas" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="salidas" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </>
  );
}
