import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { MessageSquarePlus, Inbox, Send, Reply } from "lucide-react";

type Tipo = "sugerencia" | "nota" | "reporte_bug" | "pregunta";
type Estado = "abierta" | "en_revision" | "respondida" | "cerrada";

interface Sugerencia {
  id: string;
  asunto: string;
  mensaje: string;
  tipo: Tipo;
  estado: Estado;
  respuesta: string | null;
  respondida_en: string | null;
  user_id: string;
  created_at: string;
  autor_email?: string;
}

const TIPO_LABEL: Record<Tipo, string> = {
  sugerencia: "Sugerencia",
  nota: "Nota",
  reporte_bug: "Reporte de bug",
  pregunta: "Pregunta",
};

const ESTADO_LABEL: Record<Estado, string> = {
  abierta: "Abierta",
  en_revision: "En revisión",
  respondida: "Respondida",
  cerrada: "Cerrada",
};

const ESTADO_COLOR: Record<Estado, string> = {
  abierta: "bg-blue-500",
  en_revision: "bg-amber-500",
  respondida: "bg-green-600",
  cerrada: "bg-muted-foreground",
};

export default function Sugerencias() {
  const { user, tenant, isAdmin } = useAuth();
  const [items, setItems] = useState<Sugerencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [openNueva, setOpenNueva] = useState(false);
  const [form, setForm] = useState({ asunto: "", mensaje: "", tipo: "sugerencia" as Tipo });
  const [enviando, setEnviando] = useState(false);
  const [respondiendo, setRespondiendo] = useState<Sugerencia | null>(null);
  const [respuestaForm, setRespuestaForm] = useState({ respuesta: "", estado: "respondida" as Estado });

  const cargar = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("sugerencias")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Error al cargar: " + error.message);
      setLoading(false);
      return;
    }
    let list = (data || []) as Sugerencia[];
    if (isAdmin && list.length > 0) {
      const userIds = Array.from(new Set(list.map((x) => x.user_id)));
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, email")
        .in("id", userIds);
      const mapa = new Map((profs || []).map((p) => [p.id, p.email]));
      list = list.map((s) => ({ ...s, autor_email: mapa.get(s.user_id) || "" }));
    }
    setItems(list);
    setLoading(false);
  };

  useEffect(() => {
    if (tenant) cargar();
  }, [tenant?.id]);

  const enviar = async () => {
    if (!form.asunto.trim() || !form.mensaje.trim()) {
      toast.error("Completa el asunto y el mensaje");
      return;
    }
    if (!user || !tenant) return;
    setEnviando(true);
    const { error } = await supabase.from("sugerencias").insert({
      tenant_id: tenant.id,
      user_id: user.id,
      asunto: form.asunto.trim(),
      mensaje: form.mensaje.trim(),
      tipo: form.tipo,
    });
    setEnviando(false);
    if (error) {
      toast.error("Error: " + error.message);
      return;
    }
    toast.success("Sugerencia enviada al administrador");
    setForm({ asunto: "", mensaje: "", tipo: "sugerencia" });
    setOpenNueva(false);
    cargar();
  };

  const guardarRespuesta = async () => {
    if (!respondiendo) return;
    const { error } = await supabase
      .from("sugerencias")
      .update({
        respuesta: respuestaForm.respuesta.trim() || null,
        estado: respuestaForm.estado,
        respondida_por: user?.id,
        respondida_en: new Date().toISOString(),
      })
      .eq("id", respondiendo.id);
    if (error) {
      toast.error("Error: " + error.message);
      return;
    }
    toast.success("Respuesta guardada");
    setRespondiendo(null);
    cargar();
  };

  const cambiarEstado = async (id: string, estado: Estado) => {
    const { error } = await supabase.from("sugerencias").update({ estado }).eq("id", id);
    if (error) {
      toast.error("Error: " + error.message);
      return;
    }
    cargar();
  };

  const propias = items.filter((s) => s.user_id === user?.id);
  const otras = items.filter((s) => s.user_id !== user?.id);

  const renderItem = (s: Sugerencia, esAdminView: boolean) => (
    <Card key={s.id}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base">{s.asunto}</CardTitle>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">{TIPO_LABEL[s.tipo]}</Badge>
              <Badge className={`${ESTADO_COLOR[s.estado]} text-white hover:opacity-90`}>
                {ESTADO_LABEL[s.estado]}
              </Badge>
              <span>{new Date(s.created_at).toLocaleString()}</span>
              {esAdminView && s.autor_email && <span>— {s.autor_email}</span>}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="whitespace-pre-wrap text-sm">{s.mensaje}</p>

        {s.respuesta && (
          <div className="rounded-md border-l-4 border-primary bg-muted/40 p-3">
            <div className="mb-1 text-xs font-medium text-muted-foreground">
              Respuesta del administrador
              {s.respondida_en && ` · ${new Date(s.respondida_en).toLocaleString()}`}
            </div>
            <p className="whitespace-pre-wrap text-sm">{s.respuesta}</p>
          </div>
        )}

        {esAdminView && isAdmin && (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setRespondiendo(s);
                setRespuestaForm({
                  respuesta: s.respuesta || "",
                  estado: s.estado === "abierta" ? "respondida" : s.estado,
                });
              }}
            >
              <Reply className="mr-1 h-3 w-3" /> Responder
            </Button>
            <Select value={s.estado} onValueChange={(v) => cambiarEstado(s.id, v as Estado)}>
              <SelectTrigger className="h-8 w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ESTADO_LABEL) as Estado[]).map((e) => (
                  <SelectItem key={e} value={e}>{ESTADO_LABEL[e]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sugerencias y notas"
        description="Envía sugerencias, notas o reportes al administrador de tu empresa"
        actions={
          <Dialog open={openNueva} onOpenChange={setOpenNueva}>
            <DialogTrigger asChild>
              <Button>
                <MessageSquarePlus className="mr-2 h-4 w-4" /> Nueva sugerencia
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nueva sugerencia</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Tipo</Label>
                  <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v as Tipo })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(TIPO_LABEL) as Tipo[]).map((t) => (
                        <SelectItem key={t} value={t}>{TIPO_LABEL[t]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Asunto</Label>
                  <Input
                    value={form.asunto}
                    onChange={(e) => setForm({ ...form, asunto: e.target.value })}
                    placeholder="Resumen breve"
                    maxLength={120}
                  />
                </div>
                <div>
                  <Label>Mensaje</Label>
                  <Textarea
                    value={form.mensaje}
                    onChange={(e) => setForm({ ...form, mensaje: e.target.value })}
                    placeholder="Describe tu sugerencia, nota o problema con el mayor detalle posible"
                    rows={6}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpenNueva(false)}>Cancelar</Button>
                <Button onClick={enviar} disabled={enviando}>
                  <Send className="mr-2 h-4 w-4" /> {enviando ? "Enviando..." : "Enviar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {isAdmin ? (
        <Tabs defaultValue="bandeja">
          <TabsList>
            <TabsTrigger value="bandeja">
              <Inbox className="mr-2 h-4 w-4" /> Bandeja del equipo ({otras.length})
            </TabsTrigger>
            <TabsTrigger value="propias">Mis sugerencias ({propias.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="bandeja" className="space-y-3">
            {loading ? (
              <p className="text-sm text-muted-foreground">Cargando...</p>
            ) : otras.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
                No hay sugerencias del equipo todavía.
              </CardContent></Card>
            ) : (
              otras.map((s) => renderItem(s, true))
            )}
          </TabsContent>
          <TabsContent value="propias" className="space-y-3">
            {propias.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
                Aún no has enviado sugerencias.
              </CardContent></Card>
            ) : (
              propias.map((s) => renderItem(s, false))
            )}
          </TabsContent>
        </Tabs>
      ) : (
        <div className="space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : propias.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
              Aún no has enviado sugerencias. Usa el botón de arriba para crear la primera.
            </CardContent></Card>
          ) : (
            propias.map((s) => renderItem(s, false))
          )}
        </div>
      )}

      <Dialog open={!!respondiendo} onOpenChange={(v) => !v && setRespondiendo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Responder sugerencia</DialogTitle>
          </DialogHeader>
          {respondiendo && (
            <div className="space-y-4">
              <div className="rounded-md bg-muted/40 p-3 text-sm">
                <div className="mb-1 font-medium">{respondiendo.asunto}</div>
                <p className="whitespace-pre-wrap text-muted-foreground">{respondiendo.mensaje}</p>
              </div>
              <div>
                <Label>Estado</Label>
                <Select
                  value={respuestaForm.estado}
                  onValueChange={(v) => setRespuestaForm({ ...respuestaForm, estado: v as Estado })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ESTADO_LABEL) as Estado[]).map((e) => (
                      <SelectItem key={e} value={e}>{ESTADO_LABEL[e]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Respuesta</Label>
                <Textarea
                  value={respuestaForm.respuesta}
                  onChange={(e) => setRespuestaForm({ ...respuestaForm, respuesta: e.target.value })}
                  rows={5}
                  placeholder="Escribe tu respuesta para el autor..."
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRespondiendo(null)}>Cancelar</Button>
            <Button onClick={guardarRespuesta}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
