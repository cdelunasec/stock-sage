import { MessageCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const NUMERO = "18492591279"; // formato internacional sin '+'

export const SoporteWhatsApp = () => {
  const { user, tenant } = useAuth();

  const mensaje = encodeURIComponent(
    `Hola, soy ${user?.email || "un usuario"}${tenant?.nombre ? ` de la empresa "${tenant.nombre}"` : ""}. Necesito ayuda con DL-Stock.`
  );
  const href = `https://wa.me/${NUMERO}?text=${mensaje}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Contactar soporte por WhatsApp"
      className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-3 text-white shadow-lg transition-transform hover:scale-105 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#25D366] print:hidden no-print"
    >
      <MessageCircle className="h-5 w-5" />
      <span className="hidden text-sm font-medium sm:inline">Soporte</span>
    </a>
  );
};
