import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function Terminos() {
  return (
    <div className="mx-auto max-w-3xl p-6">
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link to="/auth"><ArrowLeft className="mr-2 h-4 w-4" />Volver</Link>
      </Button>
      <h1 className="mb-6 text-3xl font-bold">Términos y Condiciones de Uso</h1>
      <div className="prose prose-sm max-w-none space-y-4 text-foreground">
        <p><strong>Última actualización:</strong> {new Date().getFullYear()}</p>

        <h2 className="text-xl font-semibold">1. Aceptación</h2>
        <p>Al registrarte y utilizar DL-Stock aceptas estos términos. Si no estás de acuerdo, no uses el servicio.</p>

        <h2 className="text-xl font-semibold">2. Descripción del servicio</h2>
        <p>DL-Stock es una plataforma de gestión de inventario, ventas y facturación para pequeñas y medianas empresas. El servicio se ofrece "tal cual" y puede modificarse o suspenderse en cualquier momento.</p>

        <h2 className="text-xl font-semibold">3. Cuenta de usuario</h2>
        <p>Eres responsable de mantener la confidencialidad de tu contraseña y de toda actividad realizada con tu cuenta. Notifícanos inmediatamente cualquier uso no autorizado.</p>

        <h2 className="text-xl font-semibold">4. Uso aceptable</h2>
        <p>Está prohibido: (a) usar el servicio para fines ilegales, (b) intentar acceder a cuentas o datos de otros usuarios, (c) sobrecargar la infraestructura, (d) revender el acceso sin autorización.</p>

        <h2 className="text-xl font-semibold">5. Datos del cliente</h2>
        <p>Conservas la propiedad de tus datos. DL-Stock los almacena para prestarte el servicio y nunca los venderá a terceros. Puedes exportarlos en cualquier momento desde Configuración.</p>

        <h2 className="text-xl font-semibold">6. Suscripción y pagos</h2>
        <p>Los planes activos se renuevan según lo acordado. La falta de pago suspende la creación y modificación de registros, pero no borra tus datos durante el período de gracia.</p>

        <h2 className="text-xl font-semibold">7. Limitación de responsabilidad</h2>
        <p>DL-Stock no se hace responsable por pérdidas indirectas, lucro cesante o daños derivados del uso o imposibilidad de uso del servicio. Realizamos respaldos pero recomendamos exportar tus datos periódicamente.</p>

        <h2 className="text-xl font-semibold">8. Cumplimiento fiscal</h2>
        <p>El usuario es el único responsable de la exactitud de la información fiscal (NCF, RNC, totales) y del cumplimiento ante la DGII u otras autoridades.</p>

        <h2 className="text-xl font-semibold">9. Modificaciones</h2>
        <p>Estos términos pueden actualizarse. El uso continuado tras una modificación implica aceptación.</p>

        <h2 className="text-xl font-semibold">10. Contacto</h2>
        <p>Para consultas legales escríbenos a través del sistema de soporte.</p>
      </div>
    </div>
  );
}
