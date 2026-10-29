import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";

export interface Almacen {
  id: string;
  nombre: string;
  direccion: string | null;
  activo: boolean;
}

interface AlmacenContextValue {
  almacenes: Almacen[];
  almacenActivo: Almacen | null;
  setAlmacenActivo: (a: Almacen | null) => void;
  reload: () => Promise<void>;
}

const AlmacenContext = createContext<AlmacenContextValue | undefined>(undefined);

export const AlmacenProvider = ({ children }: { children: ReactNode }) => {
  const { tenant } = useAuth();
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [almacenActivo, setAlmacenActivoState] = useState<Almacen | null>(null);

  const setAlmacenActivo = (a: Almacen | null) => {
    setAlmacenActivoState(a);
    if (a) localStorage.setItem("almacen_activo", a.id);
    else localStorage.removeItem("almacen_activo");
  };

  const reload = useCallback(async () => {
    if (!tenant) {
      setAlmacenes([]);
      setAlmacenActivoState(null);
      return;
    }
    const { data, error } = await supabase.from("almacenes").select("*").eq("activo", true).order("nombre");
    if (error) {
      console.error("[Almacen] error cargando:", error);
      setAlmacenes([]);
      setAlmacenActivoState(null);
      return;
    }
    const list = (data || []) as Almacen[];
    setAlmacenes(list);
    const stored = localStorage.getItem("almacen_activo");
    const found = list.find((a) => a.id === stored) || list[0] || null;
    setAlmacenActivoState(found);
  }, [tenant]);

  useEffect(() => { reload(); }, [reload]);

  return (
    <AlmacenContext.Provider value={{ almacenes, almacenActivo, setAlmacenActivo, reload }}>
      {children}
    </AlmacenContext.Provider>
  );
};

export const useAlmacen = () => {
  const ctx = useContext(AlmacenContext);
  if (!ctx) throw new Error("useAlmacen must be used within AlmacenProvider");
  return ctx;
};
