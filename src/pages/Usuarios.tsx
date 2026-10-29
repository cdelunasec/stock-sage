import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useConfirm } from "@/components/ConfirmDialog";
import { UserPlus, Trash2, Shield, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Navigate, useSearchParams } from "react-router-dom";
import { logAudit } from "@/lib/audit";

type Role = "admin" | "supervisor" | "empleado";

interface UserRow {
  id: string;
  email: string | null;
  nombre_completo: string | null;
  roles: Role[];
}

const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrador",
  supervisor: "Supervisor",
  empleado: "Empleado",
};

const ROLE_DESCRIPCION: Record<Role, string> = {
  admin: "Acceso total: configuración, suscripción, usuarios y datos.",
  supervisor: "Gestiona productos, ventas, stock y reportes. Sin configuración.",
  empleado: "Crea ventas y consulta. Sin gestión de catálogo.",
};

export default function Usuarios() {
  const { tenant, subscription, isAdmin, user: currentUser } = useAuth();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", nombre_completo: "", role: "empleado" as Role });

  const cargar = async () => {
    if (!tenant) return;
    setLoading(true);
    const { data: profiles } = await supabase
      .from("profiles").select("id, email, nombre_completo").eq("tenant_id", tenant.id);
    const { data: roles } = await supabase
      .from("user_roles").select("user_id, role").eq("tenant_id", tenant.id);
    const map: UserRow[] = (profiles || []).map((p) => ({
      id: p.id, email: p.email, nombre_completo: p.nombre_completo,
      roles: (roles || []).filter((r) => r.user_id === p.id).map((r) => r.role as Role),
    }));
    setRows(map);
    setLoading(false);
  };

  useEffect(() => { cargar(); }, [tenant?.id]);

  const [sp, setSp] = useSearchParams();
  useEffect(() => {
    if (sp.get("nuevo") === "1" && isAdmin) {
      setOpen(true);
      sp.delete("nuevo"); setSp(sp, { replace: true });
    }
  }, [sp, isAdmin]);

  if (!isAdmin) return <Navigate to="/" replace />;

  const usados = rows.length;
  const limite = subscription?.max_usuarios ?? 0;
  const lleno = usados >= limite;

  const invitar = async () => {
    if (!form.email.trim() || !form.password.trim()) {
      toast.error("Completa email y contraseña"); return;
    }
    if (form.password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres"); return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("tenant-invite-user", {
        body: {
          email: form.email.trim().toLowerCase(),
          password: form.password,
          nombre_completo: form.nombre_completo.trim() || null,
          role: form.role,
        },
      });
      // Cuando la edge function devuelve status >= 400, supabase-js pone error
      // pero el cuerpo con { error: "..." } viene en error.context (FunctionsHttpError)
      if (error) {
        let detail = error.message;
        try {
          const ctx: any = (error as any).context;
          if (ctx?.json) {
            const j = await ctx.json();
            if (j?.error) detail = j.error;
          } else if (ctx?.body) {
            const txt = typeof ctx.body === "string" ? ctx.body : await new Response(ctx.body).text();
            try { const j = JSON.parse(txt); if (j?.error) detail = j.error; } catch { detail = txt || detail; }
          }
        } catch { /* noop */ }
        throw new Error(detail);
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      await logAudit("usuario_invitado", "usuario", (data as any)?.user_id ?? null, {
        email: form.email.trim().toLowerCase(), role: form.role, nombre: form.nombre_completo.trim() || null,
      });
      toast.success("Usuario creado");
      setOpen(false);
      setForm({ email: "", password: "", nombre_completo: "", role: "empleado" });
      cargar();
    } catch (e: any) {
      toast.error(e.message || "No se pudo crear el usuario");
    } finally {
      setSaving(false);
    }
  };

  const cambiarRol = async (userId: string, nuevoRol: Role) => {
    if (!tenant) return;
    if (userId === currentUser?.id && nuevoRol !== "admin") {
      toast.error("No puedes quitarte tu propio rol de administrador");
      return;
    }
    const { error: delErr } = await supabase
      .from("user_roles").delete().eq("user_id", userId).eq("tenant_id", tenant.id);
    if (delErr) { toast.error(delErr.message); return; }
    const { error: insErr } = await supabase
      .from("user_roles").insert({ user_id: userId, tenant_id: tenant.id, role: nuevoRol });
    if (insErr) { toast.error(insErr.message); return; }
    await logAudit("usuario_rol_actualizado", "usuario", userId, { nuevo_rol: nuevoRol });
    toast.success("Rol actualizado");
    cargar();
  };

  const eliminar = async (userId: string, email: string | null) => {
    const ok = await confirm({
      title: "Eliminar usuario",
      description: `¿Eliminar a ${email || "este usuario"}? Esta acción no se puede deshacer.`,
      variant: "destructive",
      confirmText: "Eliminar",
    });
    if (!ok) return;
    try {
      const { data, error } = await supabase.functions.invoke("tenant-remove-user", {
        body: { user_id: userId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      await logAudit("usuario_eliminado", "usuario", userId, { email });
      toast.success("Usuario eliminado");
      cargar();
    } catch (e: any) {
      toast.error(e.message || "No se pudo eliminar");
    }
  };

  return (
    <>
      <PageHeader
        title="Usuarios"
        description="Gestiona los miembros de tu empresa y sus permisos"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button disabled={lleno}>
                <UserPlus className="mr-2 h-4 w-4" /> Invitar usuario
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invitar nuevo usuario</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3">
                <div className="space-y-1.5">
                  <Label>Nombre completo</Label>
                  <Input value={form.nombre_completo} onChange={(e) => setForm({ ...form, nombre_completo: e.target.value })} placeholder="Juan Pérez" />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="usuario@empresa.com" />
                </div>
                <div className="space-y-1.5">
                  <Label>Contraseña temporal</Label>
                  <Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Mínimo 6 caracteres" />
                  <p className="text-xs text-muted-foreground">Compártela con el usuario; podrá cambiarla luego.</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Rol</Label>
                  <Select value={form.role} onValueChange={(v: Role) => setForm({ ...form, role: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(["admin", "supervisor", "empleado"] as Role[]).map((r) => (
                        <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">{ROLE_DESCRIPCION[form.role]}</p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={invitar} disabled={saving}>{saving ? "Creando..." : "Crear usuario"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card className="shadow-soft">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Usuarios</p>
            <p className="text-2xl font-bold">{usados} / {limite}</p>
          </CardContent>
        </Card>
        <Card className="shadow-soft">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Plan</p>
            <p className="text-2xl font-bold capitalize">{subscription?.plan}</p>
          </CardContent>
        </Card>
        <Card className="shadow-soft">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Disponibles</p>
            <p className="text-2xl font-bold">{Math.max(0, limite - usados)}</p>
          </CardContent>
        </Card>
      </div>

      {lleno && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 text-warning" />
          <div>
            <p className="font-medium">Has alcanzado el límite de usuarios de tu plan.</p>
            <p className="text-muted-foreground">Mejora tu plan para invitar más miembros a tu equipo.</p>
          </div>
        </div>
      )}

      <Card className="shadow-soft">
        <CardHeader><CardTitle className="text-base">Miembros del equipo</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Cargando...</p>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No hay usuarios.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((u) => {
                    const principal = (u.roles[0] || "empleado") as Role;
                    const esYo = u.id === currentUser?.id;
                    return (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                              {(u.nombre_completo || u.email || "?").slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium">{u.nombre_completo || "—"}</p>
                              {esYo && <Badge variant="outline" className="mt-0.5 h-5 text-[10px]">Tú</Badge>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                        <TableCell>
                          <Select value={principal} onValueChange={(v: Role) => cambiarRol(u.id, v)}>
                            <SelectTrigger className="h-8 w-[150px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(["admin", "supervisor", "empleado"] as Role[]).map((r) => (
                                <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right">
                          {!esYo && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => eliminar(u.id, u.email)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4 shadow-soft">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4" /> Roles y permisos</CardTitle></CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-3">
          {(["admin", "supervisor", "empleado"] as Role[]).map((r) => (
            <div key={r} className="rounded-lg border bg-muted/30 p-3">
              <p className="font-semibold">{ROLE_LABELS[r]}</p>
              <p className="mt-1 text-xs text-muted-foreground">{ROLE_DESCRIPCION[r]}</p>
            </div>
          ))}
        </CardContent>
      </Card>
      {confirmDialog}
    </>
  );
}
