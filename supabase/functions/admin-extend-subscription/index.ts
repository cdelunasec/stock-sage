import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Body {
  action: "extend" | "set_plan" | "set_status";
  tenant_id: string;
  days?: number;
  plan?: "basico" | "profesional" | "empresarial";
  status?: "activa" | "vencida" | "cancelada" | "prueba";
  max_productos?: number;
  max_almacenes?: number;
  max_usuarios?: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const admin = createClient(supabaseUrl, serviceKey);

    // Verificar JWT con firma criptográfica
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: userResult, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userResult?.user) {
      return new Response(JSON.stringify({ error: "Sesión inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userResult.user.id;

    if (!userId) {
      return new Response(JSON.stringify({ error: "Sesión inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userData = { user: { id: userId } };
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "superadmin")
      .maybeSingle();

    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Solo superadmin" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as Body;
    if (!body?.tenant_id || !body?.action) {
      return new Response(JSON.stringify({ error: "Parámetros inválidos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verificar que el tenant existe
    const { data: tenantExists } = await admin
      .from("tenants").select("id").eq("id", body.tenant_id).maybeSingle();
    if (!tenantExists) {
      return new Response(JSON.stringify({ error: "Empresa no encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const update: Record<string, unknown> = {};

    if (body.action === "extend") {
      const days = Number(body.days) || 30;
      const { data: sub } = await admin
        .from("subscriptions")
        .select("expires_at")
        .eq("tenant_id", body.tenant_id)
        .maybeSingle();
      const base = sub?.expires_at ? new Date(sub.expires_at) : new Date();
      const reference = base.getTime() < Date.now() ? new Date() : base;
      const newDate = new Date(reference.getTime() + days * 86400000);
      update.expires_at = newDate.toISOString();
      update.status = "activa";
    } else if (body.action === "set_plan") {
      if (!body.plan) throw new Error("plan requerido");
      update.plan = body.plan;
      const limites: Record<string, { p: number; a: number; u: number }> = {
        basico: { p: 100, a: 1, u: 3 },
        profesional: { p: 1000, a: 5, u: 10 },
        empresarial: { p: 100000, a: 50, u: 100 },
      };
      const l = limites[body.plan];
      update.max_productos = body.max_productos ?? l.p;
      update.max_almacenes = body.max_almacenes ?? l.a;
      update.max_usuarios = body.max_usuarios ?? l.u;
    } else if (body.action === "set_status") {
      if (!body.status) throw new Error("status requerido");
      update.status = body.status;
    }

    const { error, data: updated } = await admin
      .from("subscriptions")
      .update(update)
      .eq("tenant_id", body.tenant_id)
      .select();

    if (error) throw error;

    // Solo expulsar a todos los usuarios del tenant cuando la cuenta es CANCELADA.
    // 'vencida' permite lectura, así que no invalidamos sus sesiones.
    if (body.action === "set_status" && body.status === "cancelada") {
      try {
        const { data: profiles } = await admin
          .from("profiles")
          .select("id")
          .eq("tenant_id", body.tenant_id);

        let expulsados = 0;
        if (profiles && profiles.length > 0) {
          await Promise.all(
            profiles.map((p) =>
              admin.auth.admin.signOut(p.id, "global")
                .then(() => { expulsados++; })
                .catch((e) => {
                  console.warn("No se pudo cerrar sesión de", p.id, e?.message);
                })
            )
          );
        }
        console.log(`[admin-extend-subscription] Tenant ${body.tenant_id} cancelado. Usuarios expulsados: ${expulsados}`);
      } catch (e) {
        console.warn("Error expulsando usuarios:", (e as Error).message);
      }
    }

    return new Response(JSON.stringify({ ok: true, update, updated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("admin-extend-subscription error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
