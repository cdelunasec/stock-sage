import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Role = "admin" | "supervisor" | "empleado";

interface Body {
  email: string;
  password: string;
  nombre_completo?: string;
  role: Role;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json(401, { error: "No autorizado" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Decodificar JWT
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: userResult, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userResult?.user) return json(401, { error: "Sesión inválida" });
    const userId = userResult.user.id;

    // Verificar admin del tenant
    const { data: profile } = await admin
      .from("profiles").select("tenant_id").eq("id", userId).maybeSingle();
    if (!profile?.tenant_id) return json(403, { error: "Perfil no encontrado" });
    const tenantId = profile.tenant_id;

    const { data: roleRow } = await admin
      .from("user_roles").select("role")
      .eq("user_id", userId).eq("tenant_id", tenantId).eq("role", "admin").maybeSingle();
    if (!roleRow) return json(403, { error: "Solo administradores pueden invitar usuarios" });

    const body = (await req.json()) as Body;
    if (!body?.email || !body?.password || !body?.role) {
      return json(400, { error: "Faltan datos (email, contraseña o rol)" });
    }
    if (!["admin", "supervisor", "empleado"].includes(body.role)) {
      return json(400, { error: "Rol inválido" });
    }
    if (body.password.length < 6) {
      return json(400, { error: "La contraseña debe tener al menos 6 caracteres" });
    }

    const emailNorm = body.email.trim().toLowerCase();

    // Verificar si el email ya está en este tenant
    const { data: existing } = await admin
      .from("profiles").select("id, email").eq("tenant_id", tenantId).eq("email", emailNorm).maybeSingle();
    if (existing) {
      return json(409, { error: "Este email ya pertenece a un usuario de tu empresa" });
    }

    // Validar suscripción y límite
    const { data: sub } = await admin
      .from("subscriptions").select("status, expires_at, max_usuarios")
      .eq("tenant_id", tenantId).maybeSingle();
    if (!sub || !["activa", "prueba"].includes(sub.status) || new Date(sub.expires_at) < new Date()) {
      return json(403, { error: "Tu suscripción no permite agregar usuarios. Renueva tu plan." });
    }

    const { count: actuales } = await admin
      .from("profiles").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId);
    if ((actuales ?? 0) >= sub.max_usuarios) {
      return json(403, {
        error: `Has alcanzado el límite de ${sub.max_usuarios} usuario(s) de tu plan. Mejora tu plan para agregar más.`,
      });
    }

    console.log("[invite] Creando usuario auth:", emailNorm);

    // Crear usuario en Auth (esto dispara handle_new_user que crea tenant+profile+rol propios)
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: emailNorm,
      password: body.password,
      email_confirm: true,
      user_metadata: {
        nombre_completo: body.nombre_completo || emailNorm,
        invited_by_tenant: tenantId,
      },
    });

    if (createErr || !created?.user) {
      const msg = createErr?.message || "No se pudo crear el usuario";
      const friendly = /already|exist|registered|duplicate/i.test(msg)
        ? "Este email ya está registrado en otra cuenta. Pídele al usuario que use otro email."
        : msg;
      console.error("[invite] createUser error:", msg);
      return json(400, { error: friendly });
    }

    const newUserId = created.user.id;
    console.log("[invite] Usuario creado:", newUserId);

    // Esperar a que el trigger handle_new_user complete (poll hasta 3s)
    let oldTenantId: string | null = null;
    for (let i = 0; i < 15; i++) {
      const { data: prof } = await admin
        .from("profiles").select("tenant_id").eq("id", newUserId).maybeSingle();
      if (prof?.tenant_id) {
        oldTenantId = prof.tenant_id;
        break;
      }
      await sleep(200);
    }
    console.log("[invite] oldTenantId del trigger:", oldTenantId);

    // Mover profile al tenant correcto
    const { error: profErr } = await admin
      .from("profiles")
      .update({ tenant_id: tenantId, nombre_completo: body.nombre_completo || emailNorm })
      .eq("id", newUserId);
    if (profErr) {
      console.error("[invite] Error moviendo profile:", profErr.message);
      await admin.auth.admin.deleteUser(newUserId);
      return json(500, { error: "Error asignando empresa: " + profErr.message });
    }

    // Borrar TODOS los roles previos del usuario (sin importar tenant) y crear el nuevo
    const { error: delRolesErr } = await admin
      .from("user_roles").delete().eq("user_id", newUserId);
    if (delRolesErr) {
      console.error("[invite] Error borrando roles previos:", delRolesErr.message);
    }

    const { error: roleErr } = await admin.from("user_roles").insert({
      user_id: newUserId, tenant_id: tenantId, role: body.role,
    });
    if (roleErr) {
      console.error("[invite] Error asignando rol:", roleErr.message);
      await admin.auth.admin.deleteUser(newUserId);
      return json(500, { error: "Error asignando rol: " + roleErr.message });
    }

    // Limpiar tenant huérfano del trigger
    if (oldTenantId && oldTenantId !== tenantId) {
      const { count: usersLeft } = await admin
        .from("profiles").select("*", { count: "exact", head: true }).eq("tenant_id", oldTenantId);
      const { count: rolesLeft } = await admin
        .from("user_roles").select("*", { count: "exact", head: true }).eq("tenant_id", oldTenantId);
      if ((usersLeft ?? 0) === 0 && (rolesLeft ?? 0) === 0) {
        await admin.from("subscriptions").delete().eq("tenant_id", oldTenantId);
        await admin.from("almacenes").delete().eq("tenant_id", oldTenantId);
        await admin.from("tenants").delete().eq("id", oldTenantId);
        console.log("[invite] Tenant huérfano eliminado:", oldTenantId);
      }
    }

    console.log("[invite] OK", { newUserId, tenantId, role: body.role });
    return json(200, { ok: true, user_id: newUserId });
  } catch (e) {
    console.error("tenant-invite-user error:", e);
    return json(500, { error: (e as Error).message });
  }
});
