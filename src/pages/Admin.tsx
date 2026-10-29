import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Shield, CheckCircle2, XCircle, Clock, Ban, Activity, User as UserIcon } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface TenantRow {
  id: string;
  nombre: string;
  plan: string;
  status: string;
  expires_at: string;
  max_productos: number;
  max_almacenes: number;
  max_usuarios: number;
  num_productos: number;
  num_usuarios: number;
}

export default function Admin() {
  const { roles, loading } = useAuth();
  const [rows, setRows] = useState<TenantRow[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [editTenant, setEditTenant] = useState<TenantRow | null>(null);
  const [newPlan, setNewPlan] = useState("");
  const [newStatus, setNewStatus] = useState("");

  const isSuperadmin = roles.includes("superadmin");

  const load = async () => {
    setLoadingData(true);
    try {
      const [tRes, sRes, pRes, prRes] = await Promise.all([
        supabase.from("tenants").select("id, nombre"),
        supabase.from("subscriptions").select("*"),
        supabase.from("productos").select("tenant_id"),
        supabase.from("profiles").select("tenant_id"),
      ]);

      const list: TenantRow[] = (tRes.data || []).map((t) => {
        const s = (sRes.data || []).find((x) => x.tenant_id === t.id);
        return {
          id: t.id,
          nombre: t.nombre,
          plan: s?.plan || "basico",
          status: s?.status || "prueba",
          expires_at: s?.expires_at || "",
          max_productos: s?.max_productos || 0,
          max_almacenes: s?.max_almacenes || 0,
          max_usuarios: s?.max_usuarios || 0,
          num_productos: (pRes.data || []).filter((p) => p.tenant_id === t.id).length,
          num_usuarios: (prRes.data || []).filter((p) => p.tenant_id === t.id).length,
        };
      });
      // Ordenar: canceladas/vencidas primero, luego por nombre
      list.sort((a, b) => {
        const order: Record<string, number> = { cancelada: 0, vencida: 1, prueba: 2, activa: 3 };
        return (order[a.status] ?? 99) - (order[b.status] ?? 99) || a.nombre.localeCompare(b.nombre);
      });
      setRows(list);
    } catch (e) {
      toast.error("Error cargando empresas");
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (isSuperadmin) load();
  }, [isSuperadmin]);

  if (loading) return <div className="text-muted-foreground">Cargando…</div>;
  if (!isSuperadmin) return <Navigate to="/" replace />;

  const callAdmin = async (body: any, tenantId: string) => {
    setWorking(tenantId);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("admin-extend-subscription", {
        body,
        headers: { Authorization: `Bearer ${sess.session?.access_token}` },
      });
      if (error || (data as any)?.error) {
        toast.error((data as any)?.error || error?.message || "Error en la operación");
        return false;
      }
      return true;
    } catch (e: any) {
      toast.error(e?.message || "Error inesperado");
      return false;
    } finally {
      setWorking(null);
    }
  };

  const extender = async (tid: string, days: number) => {
    const ok = await callAdmin({ action: "extend", tenant_id: tid, days }, tid);
    if (ok) { toast.success(`Suscripción extendida +${days} días`); load(); }
  };

  const cambiarEstado = async (tid: string, status: string, mensaje: string) => {
    const ok = await callAdmin({ action: "set_status", tenant_id: tid, status }, tid);
    if (ok) { toast.success(mensaje); load(); }
  };

  const guardarCambios = async () => {
    if (!editTenant) return;
    let success = true;
    if (newPlan && newPlan !== editTenant.plan) {
      success = await callAdmin({ action: "set_plan", tenant_id: editTenant.id, plan: newPlan }, editTenant.id) && success;
    }
    if (newStatus && newStatus !== editTenant.status) {
      success = await callAdmin({ action: "set_status", tenant_id: editTenant.id, status: newStatus }, editTenant.id) && success;
    }
    if (success) toast.success("Cambios guardados");
    setEditTenant(null);
    load();
  };

  const statusVariant = (s: string) =>
    s === "activa" ? "default" : s === "prueba" ? "secondary" : "destructive";

  return (
    <>
      <PageHeader
        title="Administración SaaS"
        description="Control global de empresas, planes, suscripciones y accesos"
      />

      <Card className="shadow-soft">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Vencimiento</TableHead>
                <TableHead>Uso</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingData && (
                <TableRow><TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">Cargando…</TableCell></TableRow>
              )}
              {!loadingData && rows.length === 0 && (
                <TableRow><TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">Sin empresas</TableCell></TableRow>
              )}
              {rows.map((r) => {
                const venc = r.expires_at ? new Date(r.expires_at) : null;
                const vencido = venc ? venc.getTime() < Date.now() : false;
                const isCancelled = r.status === "cancelada";
                const isWorking = working === r.id;
                return (
                  <TableRow key={r.id} className={isCancelled ? "opacity-60" : ""}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        {r.nombre}
                      </div>
                      <div className="text-xs text-muted-foreground">{r.id.slice(0, 8)}…</div>
                    </TableCell>
                    <TableCell><Badge variant="outline">{r.plan}</Badge></TableCell>
                    <TableCell><Badge variant={statusVariant(r.status) as any}>{r.status}</Badge></TableCell>
                    <TableCell>
                      {venc ? (
                        <span className={vencido ? "text-destructive font-medium" : ""}>
                          {venc.toLocaleDateString()}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.num_productos}/{r.max_productos} prod · {r.num_usuarios}/{r.max_usuarios} usr
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        {isCancelled ? (
                          <Button size="sm" variant="default" disabled={isWorking}
                            onClick={() => cambiarEstado(r.id, "activa", "Cuenta reactivada")}>
                            <CheckCircle2 className="mr-1 h-3 w-3" /> Reactivar
                          </Button>
                        ) : (
                          <>
                            <Button size="sm" variant="outline" disabled={isWorking} onClick={() => extender(r.id, 7)}>+7d</Button>
                            <Button size="sm" variant="outline" disabled={isWorking} onClick={() => extender(r.id, 30)}>+30d</Button>
                            <Button size="sm" variant="outline" disabled={isWorking} onClick={() => extender(r.id, 365)}>+1año</Button>
                            <Button size="sm" variant="outline" disabled={isWorking}
                              onClick={() => cambiarEstado(r.id, "vencida", "Marcada como vencida")}>
                              <Clock className="mr-1 h-3 w-3" /> Vencer
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="destructive" disabled={isWorking}>
                                  <Ban className="mr-1 h-3 w-3" /> Cancelar
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>¿Cancelar acceso de {r.nombre}?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Los usuarios serán expulsados del sistema y no podrán acceder hasta que reactives la cuenta.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Volver</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    onClick={() => cambiarEstado(r.id, "cancelada", "Cuenta cancelada y usuarios expulsados")}>
                                    Sí, cancelar acceso
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}
                        <Button size="sm" disabled={isWorking}
                          onClick={() => { setEditTenant(r); setNewPlan(r.plan); setNewStatus(r.status); }}>
                          Editar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!editTenant} onOpenChange={(o) => !o && setEditTenant(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editTenant?.nombre}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Plan</Label>
              <Select value={newPlan} onValueChange={setNewPlan}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="basico">Básico</SelectItem>
                  <SelectItem value="profesional">Profesional</SelectItem>
                  <SelectItem value="empresarial">Empresarial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="activa">Activa</SelectItem>
                  <SelectItem value="prueba">Prueba</SelectItem>
                  <SelectItem value="vencida">Vencida</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
              {newStatus === "cancelada" && (
                <p className="text-xs text-destructive">⚠ Los usuarios serán expulsados del sistema.</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTenant(null)}>Cancelar</Button>
            <Button onClick={guardarCambios}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <UsuariosBitacoraPanel />
      <FacturasEliminablesPanel />
    </>
  );
}

function UsuariosBitacoraPanel() {
  const [users, setUsers] = useState<any[]>([]);
  const [tenants, setTenants] = useState<Map<string, string>>(new Map());
  const [busq, setBusq] = useState("");
  const [sel, setSel] = useState<any | null>(null);
  const [log, setLog] = useState<any[]>([]);
  const [loadingLog, setLoadingLog] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: profs }, { data: tnts }] = await Promise.all([
        supabase.from("profiles").select("id, email, nombre_completo, tenant_id, created_at"),
        supabase.from("tenants").select("id, nombre"),
      ]);
      const tmap = new Map<string, string>();
      (tnts || []).forEach((t) => tmap.set(t.id, t.nombre));
      setTenants(tmap);
      setUsers(profs || []);
    })();
  }, []);

  const loadLog = async (userId: string) => {
    setLoadingLog(true);
    const { data } = await supabase
      .from("audit_log")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200);
    setLog(data || []);
    setLoadingLog(false);
  };

  const abrir = (u: any) => { setSel(u); setLog([]); loadLog(u.id); };

  const filtrados = users.filter((u) =>
    !busq ||
    (u.email || "").toLowerCase().includes(busq.toLowerCase()) ||
    (u.nombre_completo || "").toLowerCase().includes(busq.toLowerCase()) ||
    (tenants.get(u.tenant_id) || "").toLowerCase().includes(busq.toLowerCase())
  );

  return (
    <Card className="mt-6 shadow-soft">
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <UserIcon className="h-4 w-4" /> Usuarios y bitácora de actividad
          </h3>
          <Input
            className="max-w-sm"
            placeholder="Buscar por email, nombre o empresa"
            value={busq}
            onChange={(e) => setBusq(e.target.value)}
          />
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead className="text-right">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtrados.slice(0, 100).map((u) => (
              <TableRow key={u.id} className="cursor-pointer hover:bg-muted/40" onClick={() => abrir(u)}>
                <TableCell className="font-medium">{u.nombre_completo || "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                <TableCell className="text-sm">{tenants.get(u.tenant_id) || "—"}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); abrir(u); }}>
                    <Activity className="mr-1 h-3.5 w-3.5" /> Ver actividad
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {filtrados.length === 0 && (
              <TableRow><TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">Sin usuarios</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>

      <Sheet open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Bitácora — {sel?.nombre_completo || sel?.email}</SheetTitle>
            <SheetDescription>
              {sel?.email} · {tenants.get(sel?.tenant_id) || "—"}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4">
            {loadingLog ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Cargando…</p>
            ) : log.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Sin actividad registrada</p>
            ) : (
              <ol className="space-y-2">
                {log.map((e) => (
                  <li key={e.id} className="rounded border bg-muted/20 p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline" className="capitalize">{e.accion.replace(/_/g, " ")}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(e.created_at).toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Entidad: <span className="font-medium">{e.entidad}</span>
                      {e.entidad_id && <span className="ml-1 font-mono">#{String(e.entidad_id).slice(0, 8)}</span>}
                    </div>
                    {e.datos && (
                      <pre className="mt-2 overflow-x-auto rounded bg-background p-2 text-[11px]">
{JSON.stringify(e.datos, null, 2)}
                      </pre>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </Card>
  );
}

function FacturasEliminablesPanel() {
  const [list, setList] = useState<any[]>([]);
  const [busq, setBusq] = useState("");
  const [target, setTarget] = useState<any | null>(null);
  const [motivo, setMotivo] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("facturas")
      .select("id, numero_factura, total, fecha_emision, estado, clientes(nombre)")
      .neq("estado", "eliminada")
      .order("fecha_emision", { ascending: false })
      .limit(200);
    setList(data || []);
  };
  useEffect(() => { load(); }, []);

  const filtradas = list.filter((f) =>
    !busq ||
    (f.numero_factura || "").toLowerCase().includes(busq.toLowerCase()) ||
    (f.clientes?.nombre || "").toLowerCase().includes(busq.toLowerCase())
  );

  const eliminar = async () => {
    if (!target) return;
    if (!motivo.trim()) { toast.error("Indica el motivo"); return; }
    setLoading(true);
    const { error } = await supabase.rpc("eliminar_factura", { _factura_id: target.id, _motivo: motivo.trim() });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Factura eliminada");
    setTarget(null); setMotivo(""); load();
  };

  return (
    <Card className="mt-6 shadow-soft">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Gestión de facturas (eliminación)</h3>
          <input
            className="rounded-md border px-3 py-1.5 text-sm"
            placeholder="Buscar por número o cliente"
            value={busq}
            onChange={(e) => setBusq(e.target.value)}
          />
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>N°</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtradas.slice(0, 50).map((f) => (
              <TableRow key={f.id}>
                <TableCell className="font-mono text-xs">{f.numero_factura}</TableCell>
                <TableCell>{f.clientes?.nombre || "Cliente ocasional"}</TableCell>
                <TableCell className="text-xs">{new Date(f.fecha_emision).toLocaleDateString()}</TableCell>
                <TableCell className="text-right font-medium">{Number(f.total).toFixed(2)}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="destructive" onClick={() => { setTarget(f); setMotivo(""); }}>
                    <Ban className="mr-1 h-3 w-3" />Eliminar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {filtradas.length === 0 && (
              <TableRow><TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">Sin resultados</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Eliminar factura {target?.numero_factura}</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="rounded border bg-muted/30 p-3 space-y-1">
              <div><strong>N°:</strong> {target?.numero_factura}</div>
              <div><strong>Cliente:</strong> {target?.clientes?.nombre || "Cliente ocasional"}</div>
              <div><strong>Total:</strong> {Number(target?.total || 0).toFixed(2)}</div>
              <div><strong>Fecha:</strong> {target?.fecha_emision && new Date(target.fecha_emision).toLocaleDateString()}</div>
            </div>
            <div className="space-y-1">
              <Label>Motivo *</Label>
              <textarea
                className="w-full rounded-md border px-3 py-2 text-sm"
                rows={3}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              La factura se marcará como eliminada y dejará de aparecer en los listados, pero se conserva en la base de datos.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)} disabled={loading}>Cancelar</Button>
            <Button variant="destructive" onClick={eliminar} disabled={loading}>
              {loading ? "Eliminando..." : "Eliminar factura"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
