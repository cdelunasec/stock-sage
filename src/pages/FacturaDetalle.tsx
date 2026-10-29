import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatQty } from "@/lib/format";
import { Printer, ArrowLeft, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";

export default function FacturaDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { tenant, isAdmin, isSuperadmin } = useAuth();
  const [factura, setFactura] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editAt, setEditAt] = useState(false);
  const [nuevoAt, setNuevoAt] = useState("");
  const [savingAt, setSavingAt] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: f } = await supabase
      .from("facturas").select("*, clientes(*)").eq("id", id).maybeSingle();
    const { data: it } = await supabase
      .from("factura_items").select("*").eq("factura_id", id);
    setFactura(f); setItems(it || []); setLoading(false);
  };
  useEffect(() => { if (id) load(); }, [id]);

  // La eliminación de facturas se gestiona desde el panel de Administración.

  const marcarPagada = async () => {
    const { error } = await supabase.from("facturas").update({ estado: "pagada" }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Marcada como pagada"); load();
  };

  if (loading) return <div className="text-muted-foreground">Cargando…</div>;
  if (!factura) return <div className="text-muted-foreground">Factura no encontrada</div>;

  const emisor = factura.datos_emisor || {};
  const cliente = factura.datos_cliente || factura.clientes || {};
  const moneda = tenant?.moneda || "USD";
  const colorPrimario = emisor.color_primario || "#2563eb";

  return (
    <>
      {/* Toolbar (no se imprime) */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Button variant="outline" onClick={() => navigate("/facturas")}>
          <ArrowLeft className="mr-2 h-4 w-4" />Volver
        </Button>
        <div className="flex gap-2">
          {factura.estado === "emitida" && (
            <Button variant="outline" onClick={marcarPagada}>Marcar pagada</Button>
          )}
          <Button onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />Imprimir / PDF
          </Button>
        </div>
      </div>

      {/* Documento imprimible */}
      <div className="invoice-sheet mx-auto max-w-4xl rounded-lg border bg-card p-8 shadow-soft print:m-0 print:max-w-none print:border-0 print:shadow-none">
        {factura.estado === "anulada" && (
          <div className="mb-4 rounded border border-destructive bg-destructive/10 px-3 py-2 text-center text-sm font-semibold uppercase text-destructive">
            FACTURA ANULADA
          </div>
        )}

        {/* Encabezado */}
        <div className="flex items-start justify-between gap-6 border-b-4 pb-6" style={{ borderColor: colorPrimario }}>
          <div className="flex items-start gap-4">
            {emisor.logo_url && (
              <img src={emisor.logo_url} alt="Logo de la empresa emisora" className="h-20 w-20 shrink-0 rounded object-contain" />
            )}
            <div>
              <h1 className="text-2xl font-bold" style={{ color: colorPrimario }}>{emisor.razon_social || emisor.nombre || tenant?.nombre}</h1>
              {emisor.identificador_fiscal && <p className="text-sm">RUC/NIT: {emisor.identificador_fiscal}</p>}
              {emisor.direccion && <p className="text-sm text-muted-foreground">{emisor.direccion}</p>}
              {emisor.telefono && <p className="text-sm text-muted-foreground">Tel: {emisor.telefono}</p>}
              {emisor.email && <p className="text-sm text-muted-foreground">{emisor.email}</p>}
            </div>
          </div>
          <div className="text-right">
            <div className="rounded px-4 py-2 text-white" style={{ backgroundColor: colorPrimario }}>
              <div className="text-xs uppercase tracking-wider opacity-90">Factura</div>
              <div className="text-2xl font-bold">{factura.numero_factura}</div>
            </div>
            <p className="mt-2 text-sm">Fecha: {new Date(factura.fecha_emision).toLocaleDateString()}</p>
            {factura.fecha_vencimiento && (
              <p className="text-sm">Vence: {new Date(factura.fecha_vencimiento).toLocaleDateString()}</p>
            )}
            {factura.ncf && (
              <p className="text-sm font-semibold">NCF: {factura.ncf}{factura.ncf_tipo ? ` (${factura.ncf_tipo})` : ""}</p>
            )}
            <Badge className="mt-2 capitalize print:hidden" variant={
              factura.estado === "pagada" ? "default" : factura.estado === "anulada" ? "destructive" : "secondary"
            }>{factura.estado}</Badge>
          </div>
        </div>

        {/* Cliente */}
        <div className="mt-6 grid grid-cols-2 gap-6">
          <div>
            <div className="text-xs font-semibold uppercase text-muted-foreground">Facturar a</div>
            <p className="mt-1 font-medium">{cliente.nombre || "Cliente ocasional"}</p>
            {cliente.identificador_fiscal && <p className="text-sm">RUC/NIT: {cliente.identificador_fiscal}</p>}
            {cliente.direccion && <p className="text-sm text-muted-foreground">{cliente.direccion}</p>}
            {cliente.telefono && <p className="text-sm text-muted-foreground">Tel: {cliente.telefono}</p>}
            {cliente.email && <p className="text-sm text-muted-foreground">{cliente.email}</p>}
          </div>
          <div>
            <div className="text-xs font-semibold uppercase text-muted-foreground">Condiciones</div>
            <p className="mt-1 text-sm capitalize">Condición: {factura.condicion_pago}</p>
            {factura.metodo_pago && <p className="text-sm capitalize">Método: {factura.metodo_pago}</p>}
            <p className="text-sm">Moneda: {moneda}</p>
          </div>
        </div>

        {/* Atendido por */}
        <div className="mt-4 rounded border bg-muted/30 px-3 py-2 text-sm">
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className="text-xs font-semibold uppercase text-muted-foreground">Atendido por: </span>
              {editAt ? (
                <span className="inline-flex items-center gap-1 align-middle">
                  <Input value={nuevoAt} onChange={(e) => setNuevoAt(e.target.value)} className="h-7 inline w-48" autoFocus />
                  <Button size="icon" variant="ghost" className="h-7 w-7" disabled={savingAt}
                    onClick={async () => {
                      if (!nuevoAt.trim()) { toast.error("Nombre vacío"); return; }
                      setSavingAt(true);
                      const { error } = await supabase.rpc("actualizar_atendido_factura", {
                        _factura_id: factura.id, _nombre: nuevoAt.trim(),
                      });
                      setSavingAt(false);
                      if (error) { toast.error(error.message); return; }
                      toast.success("Actualizado");
                      setEditAt(false); load();
                    }}><Check className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditAt(false)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </span>
              ) : (
                <span className="font-medium">{factura.atendido_por_nombre || "—"}</span>
              )}
            </div>
            {(isAdmin || isSuperadmin) && !editAt && (
              <Button size="icon" variant="ghost" className="h-7 w-7 print:hidden"
                onClick={() => { setNuevoAt(factura.atendido_por_nombre || ""); setEditAt(true); }}
                title="Editar (solo admin)"
              ><Pencil className="h-3.5 w-3.5" /></Button>
            )}
          </div>
          {(isAdmin || isSuperadmin) && factura.created_by_email && (
            <p className="mt-0.5 text-xs text-muted-foreground print:hidden">
              Cuenta que emitió: {factura.created_by_email}
            </p>
          )}
        </div>

        {/* Items */}
        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="border-b-2 text-left" style={{ borderColor: colorPrimario }}>
              <th className="py-2">Código</th>
              <th className="py-2">Descripción</th>
              <th className="py-2 text-right">Cant.</th>
              <th className="py-2">Unidad</th>
              <th className="py-2 text-right">P. Unit.</th>
              <th className="py-2 text-right">Imp. %</th>
              <th className="py-2 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => {
              const original = it.precio_original != null ? Number(it.precio_original) : null;
              const final = Number(it.precio_unitario);
              const hasDescuento = original != null && original > final;
              const descPct = hasDescuento ? ((original - final) / original) * 100 : 0;
              return (
                <tr key={it.id} className="border-b">
                  <td className="py-2 align-top">{it.codigo || "—"}</td>
                  <td className="py-2 align-top">
                    {it.descripcion}
                    {it.presentacion && <div className="text-xs text-muted-foreground">{it.presentacion}</div>}
                    {hasDescuento && (
                      <div className="text-xs text-success">
                        Desc. {descPct.toFixed(1)}% — original {formatCurrency(original!, moneda)}
                        {it.descuento_motivo && <> · {it.descuento_motivo}</>}
                      </div>
                    )}
                  </td>
                  <td className="py-2 text-right align-top">{formatQty(it.cantidad)}</td>
                  <td className="py-2 align-top">{it.unidad || "—"}</td>
                  <td className="py-2 text-right align-top">
                    {hasDescuento && (
                      <span className="mr-1 text-xs text-muted-foreground line-through">{formatCurrency(original!, moneda)}</span>
                    )}
                    {formatCurrency(final, moneda)}
                  </td>
                  <td className="py-2 text-right align-top">{Number(it.impuesto_pct).toFixed(2)}%</td>
                  <td className="py-2 text-right align-top font-medium">{formatCurrency(Number(it.subtotal), moneda)}</td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr><td colSpan={7} className="py-6 text-center text-sm text-muted-foreground">Sin ítems en esta factura</td></tr>
            )}
          </tbody>
        </table>

        {/* Totales */}
        <div className="mt-6 flex justify-end">
          <div className="w-72 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(Number(factura.subtotal), moneda)}</span></div>
            {Number(factura.descuento) > 0 && (
              <div className="flex justify-between"><span className="text-muted-foreground">Descuento</span><span>-{formatCurrency(Number(factura.descuento), moneda)}</span></div>
            )}
            <div className="flex justify-between"><span className="text-muted-foreground">Impuesto</span><span>{formatCurrency(Number(factura.impuesto), moneda)}</span></div>
            <div className="mt-2 flex justify-between border-t-2 pt-2 text-base font-bold" style={{ borderColor: colorPrimario, color: colorPrimario }}>
              <span>TOTAL</span><span>{formatCurrency(Number(factura.total), moneda)}</span>
            </div>
          </div>
        </div>

        {factura.notas && (
          <div className="mt-6 rounded border bg-muted/30 p-3 text-sm">
            <div className="text-xs font-semibold uppercase text-muted-foreground">Notas</div>
            <p className="mt-1">{factura.notas}</p>
          </div>
        )}

        {emisor.pie_factura && (
          <div className="mt-8 border-t pt-4 text-center text-xs text-muted-foreground">
            {emisor.pie_factura}
          </div>
        )}
      </div>
    </>
  );
}
