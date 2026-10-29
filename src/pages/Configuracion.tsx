import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { NumberInput } from "@/components/ui/number-input";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { exportarExcel, exportarCSVZip, importarProductosClientes } from "@/lib/backup";
import { Download, Upload, FileSpreadsheet } from "lucide-react";


export default function Configuracion() {
  const { tenant, subscription, isAdmin, refresh } = useAuth();
  const [form, setForm] = useState<any>({
    nombre: "", moneda: "USD", razon_social: "", identificador_fiscal: "",
    direccion: "", telefono: "", email: "", logo_url: "", pie_factura: "",
    serie_factura: "A", siguiente_correlativo: 1, color_primario: "#2563eb",
  });
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!tenant) return;
    (async () => {
      const { data } = await supabase.from("tenants").select("*").eq("id", tenant.id).maybeSingle();
      if (data) setForm({
        nombre: data.nombre || "",
        moneda: data.moneda || "USD",
        razon_social: data.razon_social || "",
        identificador_fiscal: data.identificador_fiscal || "",
        direccion: data.direccion || "",
        telefono: data.telefono || "",
        email: data.email || "",
        logo_url: data.logo_url || "",
        pie_factura: data.pie_factura || "",
        serie_factura: data.serie_factura || "A",
        siguiente_correlativo: data.siguiente_correlativo || 1,
        color_primario: (data as any).color_primario || "#2563eb",
      });
    })();
  }, [tenant]);

  const subirLogo = async (file: File) => {
    if (!tenant) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("El logo no debe pasar de 2 MB"); return; }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${tenant.id}/logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("branding").upload(path, file, { upsert: true, cacheControl: "3600" });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("branding").getPublicUrl(path);
      setForm((f: any) => ({ ...f, logo_url: pub.publicUrl }));
      toast.success("Logo subido. No olvides guardar.");
    } catch (e: any) {
      toast.error(e.message || "Error subiendo logo");
    } finally {
      setUploading(false);
    }
  };

  const quitarLogo = () => setForm((f: any) => ({ ...f, logo_url: "" }));

  const guardar = async () => {
    if (!tenant) return;
    const { error } = await supabase.from("tenants").update(form).eq("id", tenant.id);
    if (error) toast.error(error.message);
    else { toast.success("Empresa actualizada"); refresh(); }
  };

  return (
    <>
      <PageHeader title="Configuración" description="Datos fiscales, facturación y suscripción" />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="shadow-soft lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Datos de empresa (emisor)</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Nombre comercial</Label>
              <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} disabled={!isAdmin} />
            </div>
            <div className="space-y-2">
              <Label>Razón social</Label>
              <Input value={form.razon_social} onChange={(e) => setForm({ ...form, razon_social: e.target.value })} disabled={!isAdmin} />
            </div>
            <div className="space-y-2">
              <Label>Identificador fiscal (RUC/NIT)</Label>
              <Input value={form.identificador_fiscal} onChange={(e) => setForm({ ...form, identificador_fiscal: e.target.value })} disabled={!isAdmin} />
            </div>
            <div className="space-y-2">
              <Label>Moneda (ISO 4217)</Label>
              <Input value={form.moneda} onChange={(e) => setForm({ ...form, moneda: e.target.value.toUpperCase() })} maxLength={3} disabled={!isAdmin} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Dirección</Label>
              <Input value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} disabled={!isAdmin} />
            </div>
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} disabled={!isAdmin} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={!isAdmin} />
            </div>
            <div className="space-y-2">
              <Label>Serie de factura</Label>
              <Input value={form.serie_factura} onChange={(e) => setForm({ ...form, serie_factura: e.target.value.toUpperCase() })} maxLength={4} disabled={!isAdmin} />
            </div>
            <div className="space-y-2">
              <Label>Siguiente correlativo</Label>
              <NumberInput integer min={1} value={form.siguiente_correlativo} onChange={(v) => setForm({ ...form, siguiente_correlativo: v })} disabled={!isAdmin} />
            </div>
            <div className="space-y-2 sm:col-span-2 rounded-lg border bg-muted/30 p-4">
              <Label className="text-sm font-semibold">Marca (se muestra en facturas)</Label>
              <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
                <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-lg border bg-background">
                  {form.logo_url ? (
                    <img src={form.logo_url} alt="Logo de la empresa" className="max-h-full max-w-full object-contain" />
                  ) : (
                    <span className="text-xs text-muted-foreground">Sin logo</span>
                  )}
                </div>
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      disabled={!isAdmin || uploading}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) subirLogo(f); e.target.value = ""; }}
                      className="max-w-xs"
                    />
                    {form.logo_url && isAdmin && (
                      <Button type="button" variant="outline" size="sm" onClick={quitarLogo}>Quitar</Button>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <Label className="min-w-[110px]">Color principal</Label>
                    <input
                      type="color"
                      value={form.color_primario || "#2563eb"}
                      onChange={(e) => setForm({ ...form, color_primario: e.target.value })}
                      disabled={!isAdmin}
                      className="h-9 w-14 cursor-pointer rounded border bg-background"
                    />
                    <Input
                      value={form.color_primario || ""}
                      onChange={(e) => setForm({ ...form, color_primario: e.target.value })}
                      disabled={!isAdmin}
                      className="max-w-[120px]"
                      placeholder="#2563eb"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Pie de factura (texto legal)</Label>
              <Textarea rows={2} value={form.pie_factura} onChange={(e) => setForm({ ...form, pie_factura: e.target.value })} disabled={!isAdmin} />
            </div>
            {isAdmin && (
              <div className="sm:col-span-2">
                <Button onClick={guardar}>Guardar cambios</Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader><CardTitle className="text-base">Suscripción</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Plan</span>
              <Badge variant="secondary" className="capitalize">{subscription?.plan}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Estado</span>
              <Badge variant={subscription?.status === "vencida" ? "destructive" : "default"} className="capitalize">{subscription?.status}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Vence</span>
              <span className="font-medium">{subscription?.expires_at && formatDate(subscription.expires_at)}</span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 border-t pt-3">
              <div>
                <p className="text-xs text-muted-foreground">Productos</p>
                <p className="font-semibold">{subscription?.max_productos}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Almacenes</p>
                <p className="font-semibold">{subscription?.max_almacenes}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Usuarios</p>
                <p className="font-semibold">{subscription?.max_usuarios}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {isAdmin && tenant && <BackupCard tenantId={tenant.id} />}
    </>
  );
}

function BackupCard({ tenantId }: { tenantId: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const onImport = async (file: File) => {
    setBusy(true);
    try { await importarProductosClientes(file, tenantId); }
    catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  return (
    <Card className="mt-4 shadow-soft">
      <CardHeader><CardTitle className="text-base">Respaldo y restauración</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Descarga todos tus datos o importa productos y clientes desde un Excel.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => exportarExcel(tenantId)} disabled={busy} variant="outline">
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Descargar Excel
          </Button>
          <Button onClick={() => exportarCSVZip(tenantId)} disabled={busy} variant="outline">
            <Download className="mr-2 h-4 w-4" /> Descargar CSV (ZIP)
          </Button>
          <Button onClick={() => fileRef.current?.click()} disabled={busy}>
            <Upload className="mr-2 h-4 w-4" /> Importar productos/clientes
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          La importación admite hojas <strong>productos</strong> (sku, nombre, precio_venta, ...) y <strong>clientes</strong> (nombre, email, teléfono, ...). Las ventas y facturas no se importan para preservar correlativos.
        </p>
      </CardContent>
    </Card>
  );
}
