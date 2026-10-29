import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Role = "admin" | "supervisor" | "empleado" | "superadmin";

interface TenantInfo {
  id: string;
  nombre: string;
  moneda: string;
}

interface SubscriptionInfo {
  plan: "basico" | "profesional" | "empresarial";
  status: "activa" | "vencida" | "cancelada" | "prueba";
  expires_at: string;
  max_productos: number;
  max_almacenes: number;
  max_usuarios: number;
}

export type AccessState = "loading" | "ok" | "blocked_cancelled" | "blocked_expired" | "no_profile" | "invalid_session";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  tenant: TenantInfo | null;
  subscription: SubscriptionInfo | null;
  roles: Role[];
  loading: boolean;
  accessState: AccessState;
  blockReason: string | null;
  isAdmin: boolean;
  isSuperadmin: boolean;
  canManage: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessState, setAccessState] = useState<AccessState>("loading");
  const [blockReason, setBlockReason] = useState<string | null>(null);
  const processedRef = useRef(false);

  const loadProfile = async (uid: string): Promise<AccessState> => {
    try {
      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid);
      const userRoles = (rolesData || []).map((r) => r.role as Role);
      setRoles(userRoles);

      const isSuper = userRoles.includes("superadmin");

      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("tenant_id, tenants(id, nombre, moneda)")
        .eq("id", uid)
        .maybeSingle();

      if (profileErr) {
        console.error("[Auth] error perfil:", profileErr);
      }

      if (!profile) {
        if (isSuper) {
          setTenant(null);
          setSubscription(null);
          return "ok";
        }
        setBlockReason("Tu usuario no terminó de configurarse. Contacta al administrador.");
        return "no_profile";
      }

      if (profile?.tenants) setTenant(profile.tenants as TenantInfo);

      const { data: sub } = await supabase
        .from("subscriptions")
        .select("plan, status, expires_at, max_productos, max_almacenes, max_usuarios")
        .eq("tenant_id", profile.tenant_id)
        .maybeSingle();

      if (sub) {
        setSubscription(sub as SubscriptionInfo);
        if (sub.status === "cancelada") {
          setBlockReason("Tu cuenta fue cancelada por el administrador.");
          return "blocked_cancelled";
        }
      }

      return "ok";
    } catch (e) {
      console.error("[Auth] excepción cargando perfil:", e);
      setBlockReason("Error cargando tu sesión. Intenta nuevamente.");
      return "invalid_session";
    }
  };

  const refresh = async () => {
    if (user) {
      const state = await loadProfile(user.id);
      setAccessState(state);
    }
  };

  const handleSession = async (sess: Session | null) => {
    setSession(sess);
    setUser(sess?.user ?? null);
    if (!sess?.user) {
      setTenant(null);
      setSubscription(null);
      setRoles([]);
      setAccessState("invalid_session");
      setBlockReason(null);
      setLoading(false);
      return;
    }
    setBlockReason(null);
    const state = await loadProfile(sess.user.id);
    setAccessState(state);
    setLoading(false);

    if (state === "blocked_cancelled") {
      setTimeout(() => {
        supabase.auth.signOut();
      }, 1500);
    }
  };

  useEffect(() => {
    let unsub: (() => void) | null = null;

    // 1. Suscribir a cambios de auth (única fuente de verdad)
    const { data } = supabase.auth.onAuthStateChange((_event, sess) => {
      processedRef.current = true;
      handleSession(sess);
    });
    unsub = () => data.subscription.unsubscribe();

    // 2. Disparar getSession para forzar carga inicial desde storage.
    //    Si onAuthStateChange ya procesó, no volvemos a procesar.
    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      if (processedRef.current) return;
      processedRef.current = true;
      handleSession(sess);
    });

    return () => { if (unsub) unsub(); };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setAccessState("invalid_session");
  };

  return (
    <AuthContext.Provider
      value={{
        user, session, tenant, subscription, roles, loading,
        accessState, blockReason,
        isAdmin: roles.includes("admin"),
        isSuperadmin: roles.includes("superadmin"),
        canManage: roles.includes("admin") || roles.includes("supervisor") || roles.includes("superadmin"),
        refresh, signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
