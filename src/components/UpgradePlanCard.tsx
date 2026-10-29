import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, MessageCircle, Crown, Rocket } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const WHATSAPP = "18492591279";

type PlanKey = "profesional" | "empresarial";

const PLANS: Record<PlanKey, {
  nombre: string;
  precio: string;
  icon: typeof Crown;
  destacado?: boolean;
  features: string[];
}> = {
  profesional: {
    nombre: "Profesional",
    precio: "RD$ 1,500 / mes",
    icon: Rocket,
    destacado: true,
    features: [
      "Productos ilimitados",
      "Hasta 5 usuarios",
      "Hasta 3 almacenes",
      "Facturación electrónica DGII (e-CF)",
      "Reportes avanzados",
      "Soporte prioritario",
    ],
  },
  empresarial: {
    nombre: "Empresarial",
    precio: "RD$ 3,000 / mes",
    icon: Crown,
    features: [
      "Todo lo del plan Profesional",
      "Usuarios ilimitados",
      "Almacenes ilimitados",
      "Multi-empresa",
      "API y exportaciones",
      "Soporte dedicado 24/7",
    ],
  },
};

export const UpgradePlanCard = () => {
  const { subscription, user, tenant } = useAuth();
  const [selected, setSelected] = useState<PlanKey>("profesional");

  if (!subscription || subscription.status !== "prueba") return null;

  const handleUpgrade = () => {
    const plan = PLANS[selected];
    const msg = encodeURIComponent(
      `Hola, soy ${user?.email || "un usuario"}${tenant?.nombre ? ` de la empresa "${tenant.nombre}"` : ""}. ` +
      `Estoy en plan de prueba y quiero contratar el plan ${plan.nombre} (${plan.precio}) de DL-Stock. ¿Cómo procedemos?`,
    );
    window.open(`https://wa.me/${WHATSAPP}?text=${msg}`, "_blank", "noopener,noreferrer");
  };

  return (
    <Card className="mb-6 border-primary/40 bg-gradient-to-br from-primary/10 via-background to-accent shadow-soft">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base">Estás en plan de prueba</CardTitle>
            <p className="text-xs text-muted-foreground">
              Mejora tu plan para desbloquear todas las funciones sin límites.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {(Object.keys(PLANS) as PlanKey[]).map((key) => {
            const p = PLANS[key];
            const Icon = p.icon;
            const active = selected === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(key)}
                className={`flex flex-col rounded-lg border p-4 text-left transition-all ${
                  active
                    ? "border-primary bg-background shadow-md ring-2 ring-primary/30"
                    : "border-border bg-background/60 hover:border-primary/50"
                }`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5 text-primary" />
                    <span className="font-semibold">{p.nombre}</span>
                  </div>
                  {p.destacado && (
                    <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary-foreground">
                      Recomendado
                    </span>
                  )}
                </div>
                <p className="mb-3 text-lg font-bold text-foreground">{p.precio}</p>
                <ul className="space-y-1.5">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Te conectaremos por WhatsApp para activar el plan <strong>{PLANS[selected].nombre}</strong>.
          </p>
          <Button onClick={handleUpgrade} className="gap-2 bg-[#25D366] text-white hover:bg-[#1ebe57]">
            <MessageCircle className="h-4 w-4" />
            Contratar por WhatsApp
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
