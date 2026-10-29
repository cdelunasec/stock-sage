import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Boxes } from "lucide-react";

function traducirError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login credentials")) return "Email o contraseña incorrectos";
  if (m.includes("email not confirmed")) return "Debes confirmar tu correo antes de iniciar sesión";
  if (m.includes("user already registered")) return "Este email ya está registrado";
  if (m.includes("password") && m.includes("6")) return "La contraseña debe tener al menos 6 caracteres";
  if (m.includes("network")) return "Error de conexión. Revisa tu internet";
  return msg;
}

export default function Auth() {
  const navigate = useNavigate();
  const { user, accessState, blockReason, loading: ctxLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [waitingContext, setWaitingContext] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [nombre, setNombre] = useState("");
  const [aceptaTerminos, setAceptaTerminos] = useState(false);

  // Forgot password
  const [openReset, setOpenReset] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    if (!waitingContext) return;
    if (ctxLoading) return;
    if (user && accessState === "ok") {
      setWaitingContext(false);
      toast.success("Bienvenido");
      navigate("/", { replace: true });
    } else if (user && (accessState === "blocked_cancelled" || accessState === "no_profile" || accessState === "blocked_expired")) {
      setWaitingContext(false);
      toast.error(blockReason || "No tienes acceso a la aplicación");
    }
  }, [user, accessState, ctxLoading, waitingContext, blockReason, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { toast.error(traducirError(error.message)); return; }
    setWaitingContext(true);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresa.trim()) { toast.error("Ingresa el nombre de tu empresa"); return; }
    if (!aceptaTerminos) { toast.error("Debes aceptar los Términos y la Política de privacidad"); return; }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { empresa_nombre: empresa, nombre_completo: nombre || email },
      },
    });
    setLoading(false);
    if (error) toast.error(traducirError(error.message));
    else toast.success("Cuenta creada. Inicia sesión.");
  };

  const enviarReset = async () => {
    if (!resetEmail.trim()) { toast.error("Ingresa tu email"); return; }
    setResetLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setResetLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Te enviamos un correo con instrucciones");
    setOpenReset(false);
  };

  const procesando = loading || waitingContext;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-background to-accent/30 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-card">
            <Boxes className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold">DL-Stock — Inventario y Facturación Electrónica DGII</h1>
          <p className="text-sm text-muted-foreground">Software de inventario, e-CF y ventas multi-almacén para PyMEs en República Dominicana</p>
        </div>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Acceso</CardTitle>
            <CardDescription>Inicia sesión o registra tu empresa</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Iniciar sesión</TabsTrigger>
                <TabsTrigger value="signup">Registrarse</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="email-l">Email</Label>
                    <Input id="email-l" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pwd-l">Contraseña</Label>
                    <Input id="pwd-l" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>
                  <div className="text-right">
                    <button type="button" onClick={() => { setResetEmail(email); setOpenReset(true); }} className="text-sm text-primary hover:underline">
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>
                  <Button type="submit" className="w-full" disabled={procesando}>
                    {procesando ? "Procesando..." : "Iniciar sesión"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="empresa">Nombre de la empresa</Label>
                    <Input id="empresa" required value={empresa} onChange={(e) => setEmpresa(e.target.value)} placeholder="Mi Empresa S.A." />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nombre">Tu nombre</Label>
                    <Input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Juan Pérez" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email-s">Email</Label>
                    <Input id="email-s" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pwd-s">Contraseña</Label>
                    <Input id="pwd-s" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>
                  <div className="flex items-start gap-2">
                    <Checkbox id="terms" checked={aceptaTerminos} onCheckedChange={(v) => setAceptaTerminos(!!v)} />
                    <label htmlFor="terms" className="text-xs leading-tight text-muted-foreground">
                      Acepto los{" "}
                      <Link to="/terminos" target="_blank" className="text-primary hover:underline">Términos</Link>
                      {" "}y la{" "}
                      <Link to="/privacidad" target="_blank" className="text-primary hover:underline">Política de privacidad</Link>.
                    </label>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Creando cuenta..." : "Crear cuenta y empresa"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link to="/terminos" className="hover:underline">Términos</Link>
          {" · "}
          <Link to="/privacidad" className="hover:underline">Privacidad</Link>
        </p>
      </div>

      <Dialog open={openReset} onOpenChange={setOpenReset}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recuperar contraseña</DialogTitle>
            <DialogDescription>Te enviaremos un enlace a tu correo para crear una nueva contraseña.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reset-email">Email</Label>
            <Input id="reset-email" type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenReset(false)}>Cancelar</Button>
            <Button onClick={enviarReset} disabled={resetLoading}>
              {resetLoading ? "Enviando..." : "Enviar enlace"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
