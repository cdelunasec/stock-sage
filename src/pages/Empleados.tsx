import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useConfirm } from "@/components/ConfirmDialog";
import { UserPlus, Trash2, Edit2, Calendar, DollarSign, Users as UsersIcon } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/format";

interface Empleado {
  id: string;
  nombre_completo: string;
  documento: string | null;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  puesto: string | null;
  departamento: string | null;
  fecha_ingreso: string;
  fecha_salida: string | null;
  salario_base: number;
  tipo_contrato: string;
  activo: boolean;
  notas: string | null;
}

interface Asistencia {
  id: string;
  empleado_id: string;
  fecha: string;
  hora_entrada: string | null;
  hora_salida: string | null;
  estado: string;
  horas_trabajadas: number | null;
  notas: string | null;
}

interface Pago {
  id: string;
  empleado_id: string;
  periodo_inicio: string;
  periodo_fin: string;
  salario_base: number;
  bonificaciones: number;
  deducciones: number;
  total: number;
  fecha_pago: string;
  metodo_pago: string | null;
  estado: string;
  notas: string | null;
}

const ESTADOS_ASISTENCIA = ["presente", "ausente", "tardanza", "permiso", "vacaciones"];
const TIPOS_CONTRATO = ["indefinido", "temporal", "por_obra", "freelance", "practicante"];

const emptyEmp = (): Partial<Empleado> => ({
  nombre_completo: "", documento: "", email: "", telefono: "", direccion: "",
  puesto: "", departamento: "",
  fecha_ingreso: new Date().toISOString().slice(0, 10),
  salario_base: 0, tipo_contrato: "indefinido", activo: true, notas: "",
});

export default function Empleados() {
  const { tenant, isAdmin, loading: authLoading } = useAuth();
  const { confirm, dialog: confirmDialog } = useConfirm();

  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [asistencias, setAsistencias] = useState<Asistencia[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal empleado
  const [empOpen, setEmpOpen] = useState(false);
  const [empEdit, setEmpEdit] = useState<Partial<Empleado> | null>(null);
  const [empSaving, setEmpSaving] = useState(false);

  // Modal asistencia
  const [asisOpen, setAsisOpen] = useState(false);
  const [asisForm, setAsisForm] = useState({
    empleado_id: "", fecha: new Date().toISOString().slice(0, 10),
    hora_entrada: "08:00", hora_salida: "17:00", estado: "presente", notas: "",
  });

  // Modal pago
  const [pagoOpen, setPagoOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const firstDay = new Date(); firstDay.setDate(1);
  const [pagoForm, setPagoForm] = useState({
    empleado_id: "",
    periodo_inicio: firstDay.toISOString().slice(0, 10),
    periodo_fin: today,
    salario_base: 0,
    bonificaciones: 0,
    deducciones: 0,
    fecha_pago: today,
    metodo_pago: "transferencia",
    estado: "pagado",
    notas: "",
    registrar_gasto: true,
  });

  const cargar = async () => {
    if (!tenant) return;
    setLoading(true);
    const [{ data: emp }, { data: asis }, { data: pg }] = await Promise.all([
      supabase.from("empleados").select("*").eq("tenant_id", tenant.id).order("nombre_completo"),
      supabase.from("asistencia").select("*").eq("tenant_id", tenant.id).order("fecha", { ascending: false }).limit(200),
      supabase.from("pagos_nomina").select("*").eq("tenant_id", tenant.id).order("fecha_pago", { ascending: false }).limit(200),
    ]);
    setEmpleados((emp || []) as Empleado[]);
    setAsistencias((asis || []) as Asistencia[]);
    setPagos((pg || []) as Pago[]);
    setLoading(false);
  };

  useEffect(() => { cargar(); }, [tenant?.id]);

  if (authLoading) return null;
  if (!isAdmin) return <Navigate to="/" replace />;

  // ===== Empleado save/delete =====
  const guardarEmpleado = async () => {
    if (!empEdit || !tenant) return;
    if (!empEdit.nombre_completo?.trim()) { toast.error("Nombre obligatorio"); return; }
    setEmpSaving(true);
    try {
      const payload = {
        tenant_id: tenant.id,
        nombre_completo: empEdit.nombre_completo.trim(),
        documento: empEdit.documento || null,
        email: empEdit.email || null,
        telefono: empEdit.telefono || null,
        direccion: empEdit.direccion || null,
        puesto: empEdit.puesto || null,
        departamento: empEdit.departamento || null,
        fecha_ingreso: empEdit.fecha_ingreso || new Date().toISOString().slice(0, 10),
        fecha_salida: empEdit.fecha_salida || null,
        salario_base: Number(empEdit.salario_base) || 0,
        tipo_contrato: empEdit.tipo_contrato || "indefinido",
        activo: empEdit.activo ?? true,
        notas: empEdit.notas || null,
      };
      let error;
      if (empEdit.id) {
        ({ error } = await supabase.from("empleados").update(payload).eq("id", empEdit.id));
      } else {
        ({ error } = await supabase.from("empleados").insert(payload));
      }
      if (error) throw error;
      toast.success(empEdit.id ? "Empleado actualizado" : "Empleado creado");
      setEmpOpen(false);
      setEmpEdit(null);
      cargar();
    } catch (e) {
      toast.error("Error: " + (e as Error).message);
    } finally {
      setEmpSaving(false);
    }
  };

  const eliminarEmpleado = async (e: Empleado) => {
    const ok = await confirm({
      title: "Eliminar empleado",
      description: `¿Eliminar a ${e.nombre_completo}? Su historial de asistencia y pagos quedará huérfano.`,
      variant: "destructive",
    });
    if (!ok) return;
    const { error } = await supabase.from("empleados").delete().eq("id", e.id);
    if (error) toast.error(error.message);
    else { toast.success("Empleado eliminado"); cargar(); }
  };

  // ===== Asistencia =====
  const calcHoras = (entrada: string, salida: string): number | null => {
    if (!entrada || !salida) return null;
    const [h1, m1] = entrada.split(":").map(Number);
    const [h2, m2] = salida.split(":").map(Number);
    const diff = (h2 * 60 + m2 - h1 * 60 - m1) / 60;
    return diff > 0 ? Math.round(diff * 100) / 100 : 0;
  };

  const guardarAsistencia = async () => {
    if (!tenant) return;
    if (!asisForm.empleado_id) { toast.error("Selecciona un empleado"); return; }
    const horas = ["presente", "tardanza"].includes(asisForm.estado)
      ? calcHoras(asisForm.hora_entrada, asisForm.hora_salida)
      : null;
    const { error } = await supabase.from("asistencia").insert({
      tenant_id: tenant.id,
      empleado_id: asisForm.empleado_id,
      fecha: asisForm.fecha,
      hora_entrada: ["presente", "tardanza"].includes(asisForm.estado) ? asisForm.hora_entrada : null,
      hora_salida: ["presente", "tardanza"].includes(asisForm.estado) ? asisForm.hora_salida : null,
      estado: asisForm.estado,
      horas_trabajadas: horas,
      notas: asisForm.notas || null,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Asistencia registrada");
      setAsisOpen(false);
      cargar();
    }
  };

  const eliminarAsistencia = async (a: Asistencia) => {
    const ok = await confirm({ title: "Eliminar registro", description: "¿Eliminar esta asistencia?", variant: "destructive" });
    if (!ok) return;
    const { error } = await supabase.from("asistencia").delete().eq("id", a.id);
    if (error) toast.error(error.message);
    else { toast.success("Eliminado"); cargar(); }
  };

  // ===== Pago nómina =====
  const abrirPago = (emp?: Empleado) => {
    setPagoForm({
      ...pagoForm,
      empleado_id: emp?.id || "",
      salario_base: Number(emp?.salario_base) || 0,
      bonificaciones: 0,
      deducciones: 0,
      notas: "",
    });
    setPagoOpen(true);
  };

  const totalPago = Number(pagoForm.salario_base) + Number(pagoForm.bonificaciones) - Number(pagoForm.deducciones);

  const guardarPago = async () => {
    if (!tenant) return;
    if (!pagoForm.empleado_id) { toast.error("Selecciona un empleado"); return; }
    const emp = empleados.find((e) => e.id === pagoForm.empleado_id);
    const total = Math.max(0, totalPago);

    let gasto_id: string | null = null;
    if (pagoForm.registrar_gasto && pagoForm.estado === "pagado") {
      const { data: g, error: gErr } = await supabase.from("gastos").insert({
        tenant_id: tenant.id,
        concepto: `Nómina ${emp?.nombre_completo || ""} (${pagoForm.periodo_inicio} a ${pagoForm.periodo_fin})`,
        categoria: "Sueldos",
        monto: total,
        fecha: pagoForm.fecha_pago,
        metodo_pago: pagoForm.metodo_pago,
        notas: pagoForm.notas || null,
      }).select("id").maybeSingle();
      if (gErr) { toast.error("Error registrando gasto: " + gErr.message); return; }
      gasto_id = g?.id || null;
    }

    const { error } = await supabase.from("pagos_nomina").insert({
      tenant_id: tenant.id,
      empleado_id: pagoForm.empleado_id,
      periodo_inicio: pagoForm.periodo_inicio,
      periodo_fin: pagoForm.periodo_fin,
      salario_base: Number(pagoForm.salario_base) || 0,
      bonificaciones: Number(pagoForm.bonificaciones) || 0,
      deducciones: Number(pagoForm.deducciones) || 0,
      total,
      fecha_pago: pagoForm.fecha_pago,
      metodo_pago: pagoForm.metodo_pago,
      estado: pagoForm.estado,
      notas: pagoForm.notas || null,
      gasto_id,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Pago registrado");
      setPagoOpen(false);
      cargar();
    }
  };

  const eliminarPago = async (p: Pago) => {
    const ok = await confirm({ title: "Eliminar pago", description: "¿Eliminar este pago de nómina? El gasto vinculado NO se eliminará.", variant: "destructive" });
    if (!ok) return;
    const { error } = await supabase.from("pagos_nomina").delete().eq("id", p.id);
    if (error) toast.error(error.message);
    else { toast.success("Eliminado"); cargar(); }
  };

  // ===== Métricas =====
  const activos = empleados.filter((e) => e.activo).length;
  const nominaMensual = empleados.filter((e) => e.activo).reduce((s, e) => s + Number(e.salario_base), 0);
  const moneda = tenant?.moneda || "USD";

  const empMap = new Map(empleados.map((e) => [e.id, e.nombre_completo]));

  return (
    <div>
      <PageHeader
        title="Recursos Humanos"
        description="Gestiona empleados, asistencia y nómina"
        actions={
          <Button onClick={() => { setEmpEdit(emptyEmp()); setEmpOpen(true); }}>
            <UserPlus className="mr-2 h-4 w-4" /> Nuevo empleado
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Empleados activos</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold flex items-center gap-2"><UsersIcon className="h-5 w-5 text-muted-foreground" />{activos}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Nómina mensual estimada</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold flex items-center gap-2"><DollarSign className="h-5 w-5 text-muted-foreground" />{formatCurrency(nominaMensual, moneda)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Pagos este mes</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(
                pagos.filter((p) => p.fecha_pago.slice(0, 7) === today.slice(0, 7))
                  .reduce((s, p) => s + Number(p.total), 0),
                moneda
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="empleados">
        <TabsList>
          <TabsTrigger value="empleados">Empleados</TabsTrigger>
          <TabsTrigger value="asistencia">Asistencia</TabsTrigger>
          <TabsTrigger value="nomina">Nómina</TabsTrigger>
        </TabsList>

        {/* EMPLEADOS */}
        <TabsContent value="empleados">
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-8 text-center text-muted-foreground">Cargando...</div>
              ) : empleados.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">No hay empleados registrados</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Puesto</TableHead>
                      <TableHead>Ingreso</TableHead>
                      <TableHead className="text-right">Salario</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {empleados.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell>
                          <div className="font-medium">{e.nombre_completo}</div>
                          <div className="text-xs text-muted-foreground">{e.documento || e.email || ""}</div>
                        </TableCell>
                        <TableCell>
                          <div>{e.puesto || "—"}</div>
                          <div className="text-xs text-muted-foreground">{e.departamento || ""}</div>
                        </TableCell>
                        <TableCell>{formatDate(e.fecha_ingreso)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(e.salario_base, moneda)}</TableCell>
                        <TableCell>
                          {e.activo ? <Badge>Activo</Badge> : <Badge variant="secondary">Inactivo</Badge>}
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button size="sm" variant="ghost" onClick={() => abrirPago(e)} title="Pagar nómina">
                            <DollarSign className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { setEmpEdit(e); setEmpOpen(true); }}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => eliminarEmpleado(e)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ASISTENCIA */}
        <TabsContent value="asistencia">
          <div className="mb-3 flex justify-end">
            <Button onClick={() => setAsisOpen(true)} disabled={empleados.length === 0}>
              <Calendar className="mr-2 h-4 w-4" /> Registrar asistencia
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              {asistencias.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">Sin registros</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Empleado</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Entrada</TableHead>
                      <TableHead>Salida</TableHead>
                      <TableHead className="text-right">Horas</TableHead>
                      <TableHead className="text-right"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {asistencias.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>{formatDate(a.fecha)}</TableCell>
                        <TableCell>{empMap.get(a.empleado_id) || "—"}</TableCell>
                        <TableCell><Badge variant="outline">{a.estado}</Badge></TableCell>
                        <TableCell>{a.hora_entrada || "—"}</TableCell>
                        <TableCell>{a.hora_salida || "—"}</TableCell>
                        <TableCell className="text-right">{a.horas_trabajadas ?? "—"}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" onClick={() => eliminarAsistencia(a)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* NÓMINA */}
        <TabsContent value="nomina">
          <div className="mb-3 flex justify-end">
            <Button onClick={() => abrirPago()} disabled={empleados.length === 0}>
              <DollarSign className="mr-2 h-4 w-4" /> Registrar pago
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              {pagos.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">Sin pagos registrados</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha pago</TableHead>
                      <TableHead>Empleado</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead className="text-right">Base</TableHead>
                      <TableHead className="text-right">Bonif.</TableHead>
                      <TableHead className="text-right">Deduc.</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagos.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>{formatDate(p.fecha_pago)}</TableCell>
                        <TableCell>{empMap.get(p.empleado_id) || "—"}</TableCell>
                        <TableCell className="text-xs">{formatDate(p.periodo_inicio)} → {formatDate(p.periodo_fin)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(p.salario_base, moneda)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(p.bonificaciones, moneda)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(p.deducciones, moneda)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(p.total, moneda)}</TableCell>
                        <TableCell>
                          {p.estado === "pagado" ? <Badge>Pagado</Badge> : <Badge variant="secondary">Pendiente</Badge>}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" onClick={() => eliminarPago(p)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal Empleado */}
      <Dialog open={empOpen} onOpenChange={setEmpOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{empEdit?.id ? "Editar empleado" : "Nuevo empleado"}</DialogTitle>
          </DialogHeader>
          {empEdit && (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label>Nombre completo *</Label>
                <Input value={empEdit.nombre_completo || ""} onChange={(e) => setEmpEdit({ ...empEdit, nombre_completo: e.target.value })} />
              </div>
              <div>
                <Label>Documento</Label>
                <Input value={empEdit.documento || ""} onChange={(e) => setEmpEdit({ ...empEdit, documento: e.target.value })} />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={empEdit.email || ""} onChange={(e) => setEmpEdit({ ...empEdit, email: e.target.value })} />
              </div>
              <div>
                <Label>Teléfono</Label>
                <Input value={empEdit.telefono || ""} onChange={(e) => setEmpEdit({ ...empEdit, telefono: e.target.value })} />
              </div>
              <div>
                <Label>Dirección</Label>
                <Input value={empEdit.direccion || ""} onChange={(e) => setEmpEdit({ ...empEdit, direccion: e.target.value })} />
              </div>
              <div>
                <Label>Puesto</Label>
                <Input value={empEdit.puesto || ""} onChange={(e) => setEmpEdit({ ...empEdit, puesto: e.target.value })} />
              </div>
              <div>
                <Label>Departamento</Label>
                <Input value={empEdit.departamento || ""} onChange={(e) => setEmpEdit({ ...empEdit, departamento: e.target.value })} />
              </div>
              <div>
                <Label>Fecha de ingreso</Label>
                <Input type="date" value={empEdit.fecha_ingreso || ""} onChange={(e) => setEmpEdit({ ...empEdit, fecha_ingreso: e.target.value })} />
              </div>
              <div>
                <Label>Fecha de salida</Label>
                <Input type="date" value={empEdit.fecha_salida || ""} onChange={(e) => setEmpEdit({ ...empEdit, fecha_salida: e.target.value || null })} />
              </div>
              <div>
                <Label>Salario base</Label>
                <NumberInput decimals={2} min={0} value={empEdit.salario_base ?? 0} onChange={(v) => setEmpEdit({ ...empEdit, salario_base: v })} />
              </div>
              <div>
                <Label>Tipo de contrato</Label>
                <Select value={empEdit.tipo_contrato || "indefinido"} onValueChange={(v) => setEmpEdit({ ...empEdit, tipo_contrato: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS_CONTRATO.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Estado</Label>
                <Select value={empEdit.activo ? "true" : "false"} onValueChange={(v) => setEmpEdit({ ...empEdit, activo: v === "true" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Activo</SelectItem>
                    <SelectItem value="false">Inactivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label>Notas</Label>
                <Textarea rows={2} value={empEdit.notas || ""} onChange={(e) => setEmpEdit({ ...empEdit, notas: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmpOpen(false)}>Cancelar</Button>
            <Button onClick={guardarEmpleado} disabled={empSaving}>{empSaving ? "Guardando..." : "Guardar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Asistencia */}
      <Dialog open={asisOpen} onOpenChange={setAsisOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar asistencia</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Empleado</Label>
              <Select value={asisForm.empleado_id} onValueChange={(v) => setAsisForm({ ...asisForm, empleado_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecciona..." /></SelectTrigger>
                <SelectContent>
                  {empleados.filter((e) => e.activo).map((e) => <SelectItem key={e.id} value={e.id}>{e.nombre_completo}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Fecha</Label>
                <Input type="date" value={asisForm.fecha} onChange={(e) => setAsisForm({ ...asisForm, fecha: e.target.value })} />
              </div>
              <div>
                <Label>Estado</Label>
                <Select value={asisForm.estado} onValueChange={(v) => setAsisForm({ ...asisForm, estado: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ESTADOS_ASISTENCIA.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {["presente", "tardanza"].includes(asisForm.estado) && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Hora entrada</Label>
                  <Input type="time" value={asisForm.hora_entrada} onChange={(e) => setAsisForm({ ...asisForm, hora_entrada: e.target.value })} />
                </div>
                <div>
                  <Label>Hora salida</Label>
                  <Input type="time" value={asisForm.hora_salida} onChange={(e) => setAsisForm({ ...asisForm, hora_salida: e.target.value })} />
                </div>
              </div>
            )}
            <div>
              <Label>Notas</Label>
              <Textarea rows={2} value={asisForm.notas} onChange={(e) => setAsisForm({ ...asisForm, notas: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAsisOpen(false)}>Cancelar</Button>
            <Button onClick={guardarAsistencia}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Pago */}
      <Dialog open={pagoOpen} onOpenChange={setPagoOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Registrar pago de nómina</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Empleado</Label>
              <Select
                value={pagoForm.empleado_id}
                onValueChange={(v) => {
                  const emp = empleados.find((e) => e.id === v);
                  setPagoForm({ ...pagoForm, empleado_id: v, salario_base: Number(emp?.salario_base) || 0 });
                }}
              >
                <SelectTrigger><SelectValue placeholder="Selecciona..." /></SelectTrigger>
                <SelectContent>
                  {empleados.filter((e) => e.activo).map((e) => <SelectItem key={e.id} value={e.id}>{e.nombre_completo}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Período inicio</Label>
                <Input type="date" value={pagoForm.periodo_inicio} onChange={(e) => setPagoForm({ ...pagoForm, periodo_inicio: e.target.value })} />
              </div>
              <div>
                <Label>Período fin</Label>
                <Input type="date" value={pagoForm.periodo_fin} onChange={(e) => setPagoForm({ ...pagoForm, periodo_fin: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Salario base</Label>
                <NumberInput decimals={2} min={0} value={pagoForm.salario_base} onChange={(v) => setPagoForm({ ...pagoForm, salario_base: v })} />
              </div>
              <div>
                <Label>Bonificaciones</Label>
                <NumberInput decimals={2} min={0} value={pagoForm.bonificaciones} onChange={(v) => setPagoForm({ ...pagoForm, bonificaciones: v })} />
              </div>
              <div>
                <Label>Deducciones</Label>
                <NumberInput decimals={2} min={0} value={pagoForm.deducciones} onChange={(v) => setPagoForm({ ...pagoForm, deducciones: v })} />
              </div>
            </div>
            <div className="rounded border p-3 flex justify-between items-center bg-muted/30">
              <span className="text-sm text-muted-foreground">Total a pagar</span>
              <span className="text-xl font-bold">{formatCurrency(Math.max(0, totalPago), moneda)}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Fecha de pago</Label>
                <Input type="date" value={pagoForm.fecha_pago} onChange={(e) => setPagoForm({ ...pagoForm, fecha_pago: e.target.value })} />
              </div>
              <div>
                <Label>Método de pago</Label>
                <Select value={pagoForm.metodo_pago} onValueChange={(v) => setPagoForm({ ...pagoForm, metodo_pago: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="efectivo">Efectivo</SelectItem>
                    <SelectItem value="transferencia">Transferencia</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                    <SelectItem value="tarjeta">Tarjeta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Estado</Label>
              <Select value={pagoForm.estado} onValueChange={(v) => setPagoForm({ ...pagoForm, estado: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pagado">Pagado</SelectItem>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={pagoForm.registrar_gasto} onChange={(e) => setPagoForm({ ...pagoForm, registrar_gasto: e.target.checked })} />
              Registrar también como gasto en módulo de Gastos
            </label>
            <div>
              <Label>Notas</Label>
              <Textarea rows={2} value={pagoForm.notas} onChange={(e) => setPagoForm({ ...pagoForm, notas: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPagoOpen(false)}>Cancelar</Button>
            <Button onClick={guardarPago}>Registrar pago</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {confirmDialog}
    </div>
  );
}
