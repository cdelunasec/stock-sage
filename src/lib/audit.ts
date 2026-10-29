import { supabase } from "@/integrations/supabase/client";

/**
 * Registra una acción en la bitácora del sistema (audit_log).
 * No falla silenciosamente nunca crítica: solo loguea en consola si falla.
 */
export async function logAudit(
  accion: string,
  entidad: string,
  entidadId?: string | null,
  datos?: Record<string, any> | null,
): Promise<void> {
  try {
    const { error } = await supabase.rpc("log_audit", {
      _accion: accion,
      _entidad: entidad,
      _entidad_id: entidadId ?? null,
      _datos: (datos as any) ?? null,
    });
    if (error) console.warn("[audit]", error.message);
  } catch (e) {
    console.warn("[audit] excepción:", e);
  }
}
