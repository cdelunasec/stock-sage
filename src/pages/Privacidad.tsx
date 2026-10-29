import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function Privacidad() {
  return (
    <div className="mx-auto max-w-3xl p-6">
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link to="/auth"><ArrowLeft className="mr-2 h-4 w-4" />Volver</Link>
      </Button>
      <h1 className="mb-6 text-3xl font-bold">Política de Privacidad</h1>
      <div className="prose prose-sm max-w-none space-y-4 text-foreground">
        <p><strong>Última actualización:</strong> {new Date().getFullYear()}</p>

        <h2 className="text-xl font-semibold">1. Datos que recolectamos</h2>
        <ul className="list-disc pl-6">
          <li>Datos de la cuenta: email, nombre, empresa.</li>
          <li>Datos de operación: productos, clientes, ventas, facturas que tú cargas.</li>
          <li>Datos técnicos: IP, navegador, registros de actividad para seguridad.</li>
        </ul>

        <h2 className="text-xl font-semibold">2. Uso de los datos</h2>
        <p>Usamos tus datos exclusivamente para: (a) proveerte el servicio, (b) facturarte la suscripción, (c) brindarte soporte, (d) cumplir obligaciones legales.</p>

        <h2 className="text-xl font-semibold">3. Compartir información</h2>
        <p>No vendemos ni alquilamos tu información. Solo compartimos datos con proveedores de infraestructura (almacenamiento, email) bajo acuerdos de confidencialidad, o cuando lo exija la ley.</p>

        <h2 className="text-xl font-semibold">4. Seguridad</h2>
        <p>Aplicamos cifrado en tránsito y en reposo, control de acceso basado en roles, aislamiento por empresa (multi-tenant) y respaldos periódicos. Ninguna medida es infalible.</p>

        <h2 className="text-xl font-semibold">5. Tus derechos (Ley 172-13 R.D.)</h2>
        <p>Puedes acceder, rectificar, exportar o eliminar tus datos en cualquier momento desde la sección Configuración o solicitándolo por soporte.</p>

        <h2 className="text-xl font-semibold">6. Retención</h2>
        <p>Conservamos tus datos mientras tu cuenta esté activa y por un período razonable después de la cancelación para fines legales y contables.</p>

        <h2 className="text-xl font-semibold">7. Cookies</h2>
        <p>Usamos cookies estrictamente necesarias para mantener tu sesión iniciada. No usamos cookies de publicidad de terceros.</p>

        <h2 className="text-xl font-semibold">8. Cambios</h2>
        <p>Te notificaremos por email o dentro de la aplicación cualquier cambio sustancial.</p>

        <h2 className="text-xl font-semibold">9. Contacto</h2>
        <p>Para ejercer tus derechos o resolver dudas, contáctanos a través del sistema de soporte.</p>
      </div>
    </div>
  );
}
