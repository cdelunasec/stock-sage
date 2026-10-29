import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Body {
  user_id: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: userResult, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userResult?.user) {
      return new Response(JSON.stringify({ error: "Sesión inválida" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = userResult.user.id;

    const body = (await req.json()) as Body;
    if (!body?.user_id) {
      return new Response(JSON.stringify({ error: "Falta user_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (body.user_id === callerId) {
      return new Response(JSON.stringify({ error: "No puedes eliminarte a ti mismo" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Caller debe ser admin
    const { data: callerProfile } = await admin
      .from("profiles").select("tenant_id").eq("id", callerId).maybeSingle();
    if (!callerProfile?.tenant_id) {
      return new Response(JSON.stringify({ error: "Perfil no encontrado" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const tenantId = callerProfile.tenant_id;

    const { data: callerRole } = await admin
      .from("user_roles").select("role")
      .eq("user_id", callerId).eq("tenant_id", tenantId).eq("role", "admin").maybeSingle();
    if (!callerRole) {
      return new Response(JSON.stringify({ error: "Solo administradores" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verificar que el target pertenece al mismo tenant
    const { data: target } = await admin
      .from("profiles").select("tenant_id").eq("id", body.user_id).maybeSingle();
    if (!target || target.tenant_id !== tenantId) {
      return new Response(JSON.stringify({ error: "El usuario no pertenece a tu empresa" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // No permitir borrar si es el último admin
    const { data: targetRoles } = await admin
      .from("user_roles").select("role").eq("user_id", body.user_id).eq("tenant_id", tenantId);
    if ((targetRoles || []).some((r) => r.role === "admin")) {
      const { count: adminsCount } = await admin
        .from("user_roles").select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId).eq("role", "admin");
      if ((adminsCount ?? 0) <= 1) {
        return new Response(JSON.stringify({ error: "No puedes eliminar al último administrador" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Eliminar
    await admin.from("user_roles").delete().eq("user_id", body.user_id);
    await admin.from("profiles").delete().eq("id", body.user_id);
    const { error: delErr } = await admin.auth.admin.deleteUser(body.user_id);
    if (delErr) {
      return new Response(JSON.stringify({ error: delErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("tenant-remove-user error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
