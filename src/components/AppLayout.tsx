import { ReactNode, useEffect, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { SoporteWhatsApp } from "./SoporteWhatsApp";
import { OnboardingDialog } from "./OnboardingDialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Moon, Sun, LogOut, User as UserIcon, Warehouse, AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useAlmacen } from "@/contexts/AlmacenContext";
import { differenceInDays } from "date-fns";

export const AppLayout = ({ children }: { children: ReactNode }) => {
  const { user, loading, tenant, signOut, subscription, accessState, blockReason, isSuperadmin, isAdmin } = useAuth();
  const { theme, toggle } = useTheme();
  const { almacenes, almacenActivo, setAlmacenActivo } = useAlmacen();
  const location = useLocation();

  const [stuck, setStuck] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  useEffect(() => {
    if (!loading) { setStuck(false); return; }
    const t = setTimeout(() => setStuck(true), 8000);
    return () => clearTimeout(t);
  }, [loading]);

  useEffect(() => {
    if (!user || !isAdmin || isSuperadmin) return;
    const key = `onboarding_done_${user.id}`;
    if (!localStorage.getItem(key)) setShowOnboarding(true);
  }, [user, isAdmin, isSuperadmin]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="flex flex-col items-center gap-4 rounded-lg border bg-card px-8 py-6 shadow-lg">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <span className="text-lg font-semibold">S</span>
          </div>
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
          <p className="text-sm font-medium text-foreground">Cargando tu sesión...</p>
          {stuck && (
            <div className="mt-2 flex flex-col items-center gap-2 border-t pt-3 text-center">
              <p className="text-xs text-muted-foreground">
                Está tardando más de lo normal.
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
                  Reintentar
                </Button>
                <Button size="sm" variant="ghost" onClick={signOut}>
                  Cerrar sesión
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!user || accessState === "invalid_session") {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Pantalla de bloqueo: cuenta cancelada o sin perfil
  if (accessState === "blocked_cancelled" || accessState === "no_profile" || accessState === "blocked_expired") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="max-w-md rounded-lg border bg-card p-8 text-center shadow-lg">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <h1 className="mb-2 text-xl font-semibold text-foreground">Acceso suspendido</h1>
          <p className="mb-6 text-sm text-muted-foreground">
            {blockReason || "No tienes acceso a la aplicación en este momento."}
          </p>
          <p className="mb-6 text-xs text-muted-foreground">
            {user.email}
          </p>
          <Button onClick={signOut} variant="outline" className="w-full">
            <LogOut className="mr-2 h-4 w-4" /> Cerrar sesión
          </Button>
        </div>
      </div>
    );
  }

  const initials = (user.email || "?").slice(0, 2).toUpperCase();
  const diasParaVencer = subscription ? differenceInDays(new Date(subscription.expires_at), new Date()) : null;
  const mostrarAvisoVencimiento = diasParaVencer !== null && diasParaVencer <= 7 && diasParaVencer >= 0;
  const vencida = subscription?.status === "vencida" || (diasParaVencer !== null && diasParaVencer < 0);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur">
            <SidebarTrigger />
            {!isSuperadmin && almacenes.length > 0 && (
              <div className="flex items-center gap-2">
                <Warehouse className="h-4 w-4 text-muted-foreground" />
                <Select
                  value={almacenActivo?.id || ""}
                  onValueChange={(v) => {
                    const a = almacenes.find((x) => x.id === v);
                    if (a) setAlmacenActivo(a);
                  }}
                >
                  <SelectTrigger className="h-9 w-[220px]">
                    <SelectValue placeholder="Selecciona almacén" />
                  </SelectTrigger>
                  <SelectContent>
                    {almacenes.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="ml-auto flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={toggle} aria-label="Cambiar tema">
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                      {initials}
                    </div>
                    <span className="hidden text-sm md:inline">{tenant?.nombre || (isSuperadmin ? "Superadmin" : "")}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <a href="/configuracion"><UserIcon className="mr-2 h-4 w-4" />Configuración</a>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={signOut}>
                    <LogOut className="mr-2 h-4 w-4" />Cerrar sesión
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {(mostrarAvisoVencimiento || vencida) && (
            <div className={`border-b px-6 py-2 text-sm ${vencida ? "bg-destructive text-destructive-foreground" : "bg-warning text-warning-foreground"}`}>
              {vencida
                ? "Tu suscripción ha vencido. No podrás crear ni modificar registros hasta renovar."
                : `Tu suscripción vence en ${diasParaVencer} día(s). Renueva para evitar interrupciones.`}
            </div>
          )}

          <main className="flex-1 p-6 animate-fade-in">
            {children}
          </main>
          <footer className="border-t bg-background/50 px-6 py-3 text-center text-xs text-muted-foreground">
            <Link to="/terminos" className="hover:underline">Términos</Link>
            {" · "}
            <Link to="/privacidad" className="hover:underline">Privacidad</Link>
          </footer>
        </div>
        <SoporteWhatsApp />
        <OnboardingDialog open={showOnboarding} onClose={() => setShowOnboarding(false)} />
      </div>
    </SidebarProvider>
  );
};
