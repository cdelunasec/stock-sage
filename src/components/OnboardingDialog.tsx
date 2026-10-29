import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Boxes, CheckCircle2 } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function OnboardingDialog({ open, onClose }: Props) {
  const { tenant, user, refresh } = useAuth();
  const navigate = useNavigate();
  const [paso, setPaso] = useState(1);
  const [loading, setLoading] = useState(false);

  // Paso 1
  const [empresaNombre, setEmpresaNombre] = useState(tenant?.nombre || "");
  const [logoUrl, setLogoUrl] = useState((tenant as any)?.logo_url || "");

  // Paso 2
  const [prodNombre, setProdNombre] = useState("");
  const [prodPrecio, setProdPrecio] = useState("");
  const [prodSku, setProdSku] = useState("");

  // Paso 3
  const [cliNombre, setCliNombre] = useState("");
  const [cliTel, setCliTel] = useState("");

  const finalizar = (irAVenta = false) => {
    if (user) localStorage.setItem(`onboarding_done_${user.id}`, "1");
    onClose();
    if (irAVenta) navigate("/ventas/nueva");
  };

  const subirLogo = async (file: File) => {
    if (!tenant) return;
    setLoading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${tenant.id}/logo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("branding").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: pub } = supabase.storage.from("branding").getPublicUrl(path);
      setLogoUrl(pub.publicUrl);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const guardarEmpresa = async () => {
    if (!tenant || !empresaNombre.trim()) { toast.error("Nombre requerido"); return; }
    setLoading(true);
    const { error } = await supabase.from("tenants")
      .update({ nombre: empresaNombre, logo_url: logoUrl }).eq("id", tenant.id);
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    refresh();
    setPaso(2);
  };

  const crearProducto = async () => {
    if (!tenant || !prodNombre.trim() || !prodSku.trim()) { toast.error("SKU y nombre requeridos"); return; }
    setLoading(true);
    const { error } = await supabase.from("productos").insert({
      tenant_id: tenant.id,
      sku: prodSku.trim(),
      nombre: prodNombre.trim(),
      precio_venta: Number(prodPrecio) || 0,
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Producto creado");
    setPaso(3);
  };

  const crearCliente = async () => {
    if (!tenant || !cliNombre.trim()) { toast.error("Nombre requerido"); return; }
    setLoading(true);
    const { error } = await supabase.from("clientes").insert({
      tenant_id: tenant.id,
      nombre: cliNombre.trim(),
      telefono: cliTel || null,
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Cliente creado");
    setPaso(4);
  };

  const progreso = (paso / 4) * 100;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && finalizar(false)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Boxes className="h-5 w-5" />
          </div>
          <DialogTitle>Bienvenido a DL-Stock</DialogTitle>
          <DialogDescription>Paso {paso} de 4 — configuremos lo esencial</DialogDescription>
          <Progress value={progreso} className="mt-2" />
        </DialogHeader>

        {paso === 1 && (
          <div className="space-y-4">
            <h3 className="font-semibold">1. Tu empresa</h3>
            <div className="space-y-2">
              <Label>Nombre de la empresa</Label>
              <Input value={empresaNombre} onChange={(e) => setEmpresaNombre(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Logo (opcional)</Label>
              <Input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && subirLogo(e.target.files[0])} />
              {logoUrl && <img src={logoUrl} alt="Logo de la empresa" className="h-16 w-16 rounded border object-contain" />}
            </div>
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => finalizar(false)}>Saltar todo</Button>
              <Button onClick={guardarEmpresa} disabled={loading}>Siguiente</Button>
            </div>
          </div>
        )}

        {paso === 2 && (
          <div className="space-y-4">
            <h3 className="font-semibold">2. Tu primer producto</h3>
            <div className="space-y-2">
              <Label>SKU / código</Label>
              <Input value={prodSku} onChange={(e) => setProdSku(e.target.value)} placeholder="P001" />
            </div>
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input value={prodNombre} onChange={(e) => setProdNombre(e.target.value)} placeholder="Producto demo" />
            </div>
            <div className="space-y-2">
              <Label>Precio de venta</Label>
              <Input type="number" value={prodPrecio} onChange={(e) => setProdPrecio(e.target.value)} placeholder="0" />
            </div>
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => finalizar(false)}>Saltar todo</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setPaso(3)}>Saltar paso</Button>
                <Button onClick={crearProducto} disabled={loading}>Crear y seguir</Button>
              </div>
            </div>
          </div>
        )}

        {paso === 3 && (
          <div className="space-y-4">
            <h3 className="font-semibold">3. Tu primer cliente</h3>
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input value={cliNombre} onChange={(e) => setCliNombre(e.target.value)} placeholder="Cliente demo" />
            </div>
            <div className="space-y-2">
              <Label>Teléfono (opcional)</Label>
              <Input value={cliTel} onChange={(e) => setCliTel(e.target.value)} />
            </div>
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => finalizar(false)}>Saltar todo</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setPaso(4)}>Saltar paso</Button>
                <Button onClick={crearCliente} disabled={loading}>Crear y seguir</Button>
              </div>
            </div>
          </div>
        )}

        {paso === 4 && (
          <div className="space-y-4 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
            <h3 className="text-lg font-semibold">¡Todo listo!</h3>
            <p className="text-sm text-muted-foreground">
              Ya puedes registrar tu primera venta de prueba o explorar el sistema por tu cuenta.
            </p>
            <div className="flex justify-center gap-2">
              <Button variant="outline" onClick={() => finalizar(false)}>Explorar después</Button>
              <Button onClick={() => finalizar(true)}>Hacer mi primera venta</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
