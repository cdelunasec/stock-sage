import * as XLSX from "xlsx";
import JSZip from "jszip";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const TABLAS = [
  "productos", "clientes", "proveedores", "servicios",
  "almacenes", "stock_levels", "stock_movements",
  "ventas", "venta_items",
  "facturas", "factura_items",
  "cotizaciones", "cotizacion_items",
  "gastos", "ordenes_compra", "orden_compra_items",
] as const;

async function fetchAll(table: string, tenantId: string): Promise<any[]> {
  const out: any[] = [];
  let from = 0;
  const PAGE = 1000;
  // some tables (venta_items, factura_items, cotizacion_items, orden_compra_items) don't have tenant_id
  const sinTenant = ["venta_items", "factura_items", "cotizacion_items", "orden_compra_items"];
  while (true) {
    let q = supabase.from(table as any).select("*").range(from, from + PAGE - 1);
    if (!sinTenant.includes(table)) q = q.eq("tenant_id", tenantId);
    const { data, error } = await q;
    if (error) { console.error(table, error); break; }
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

export async function exportarExcel(tenantId: string) {
  toast.info("Generando respaldo Excel...");
  const wb = XLSX.utils.book_new();
  for (const t of TABLAS) {
    const rows = await fetchAll(t, tenantId);
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ vacio: "" }]);
    XLSX.utils.book_append_sheet(wb, ws, t.slice(0, 31));
  }
  const fname = `respaldo-${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fname);
  toast.success("Respaldo descargado");
}

export async function exportarCSVZip(tenantId: string) {
  toast.info("Generando respaldo CSV...");
  const zip = new JSZip();
  for (const t of TABLAS) {
    const rows = await fetchAll(t, tenantId);
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ vacio: "" }]);
    const csv = XLSX.utils.sheet_to_csv(ws);
    zip.file(`${t}.csv`, csv);
  }
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `respaldo-${new Date().toISOString().slice(0, 10)}.zip`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success("Respaldo CSV descargado");
}

export async function importarProductosClientes(file: File, tenantId: string) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  let totalProds = 0, totalCli = 0;

  if (wb.SheetNames.includes("productos")) {
    const rows = XLSX.utils.sheet_to_json<any>(wb.Sheets["productos"]);
    const valid = rows
      .filter((r) => r.sku && r.nombre)
      .map((r) => ({
        tenant_id: tenantId,
        sku: String(r.sku),
        nombre: String(r.nombre),
        descripcion: r.descripcion || null,
        unidad: r.unidad || "unidad",
        precio_costo: Number(r.precio_costo) || 0,
        precio_venta: Number(r.precio_venta) || 0,
        impuesto_pct: Number(r.impuesto_pct) || 0,
        stock_minimo: Number(r.stock_minimo) || 0,
        codigo_barras: r.codigo_barras || null,
        activo: r.activo === false ? false : true,
      }));
    if (valid.length) {
      const { error } = await supabase.from("productos").upsert(valid, { onConflict: "tenant_id,sku" as any });
      if (error) toast.error("Productos: " + error.message);
      else totalProds = valid.length;
    }
  }

  if (wb.SheetNames.includes("clientes")) {
    const rows = XLSX.utils.sheet_to_json<any>(wb.Sheets["clientes"]);
    const valid = rows
      .filter((r) => r.nombre)
      .map((r) => ({
        tenant_id: tenantId,
        nombre: String(r.nombre),
        email: r.email || null,
        telefono: r.telefono || null,
        direccion: r.direccion || null,
        identificador_fiscal: r.identificador_fiscal || null,
      }));
    if (valid.length) {
      const { error } = await supabase.from("clientes").insert(valid);
      if (error) toast.error("Clientes: " + error.message);
      else totalCli = valid.length;
    }
  }

  toast.success(`Importados: ${totalProds} productos, ${totalCli} clientes`);
}
