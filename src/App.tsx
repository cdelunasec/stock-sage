import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AlmacenProvider } from "@/contexts/AlmacenContext";
import { AppLayout } from "@/components/AppLayout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Productos from "./pages/Productos";
import Servicios from "./pages/Servicios";
import Almacenes from "./pages/Almacenes";
import Stock from "./pages/Stock";
import Ventas from "./pages/Ventas";
import NuevaVenta from "./pages/NuevaVenta";
import VentaDetalle from "./pages/VentaDetalle";
import Clientes from "./pages/Clientes";
import Reportes from "./pages/Reportes";
import Configuracion from "./pages/Configuracion";
import ConfiguracionNCF from "./pages/ConfiguracionNCF";
import ReportesDGII from "./pages/ReportesDGII";
import CuentasPorPagar from "./pages/CuentasPorPagar";
import Proveedores from "./pages/Proveedores";
import Facturas from "./pages/Facturas";
import FacturaDetalle from "./pages/FacturaDetalle";
import Cotizaciones from "./pages/Cotizaciones";
import NuevaCotizacion from "./pages/NuevaCotizacion";
import CotizacionDetalle from "./pages/CotizacionDetalle";
import Gastos from "./pages/Gastos";
import Usuarios from "./pages/Usuarios";
import Empleados from "./pages/Empleados";
import Admin from "./pages/Admin";
import Sugerencias from "./pages/Sugerencias";
import CuadrePersonal from "./pages/CuadrePersonal";
import ResetPassword from "./pages/ResetPassword";
import Terminos from "./pages/Terminos";
import Privacidad from "./pages/Privacidad";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const Protected = ({ children }: { children: React.ReactNode }) => (
  <AlmacenProvider>
    <AppLayout>{children}</AppLayout>
  </AlmacenProvider>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/terminos" element={<Terminos />} />
              <Route path="/privacidad" element={<Privacidad />} />
              <Route path="/" element={<Protected><Dashboard /></Protected>} />
              <Route path="/productos" element={<Protected><Productos /></Protected>} />
              <Route path="/servicios" element={<Protected><Servicios /></Protected>} />
              <Route path="/almacenes" element={<Protected><Almacenes /></Protected>} />
              <Route path="/stock" element={<Protected><Stock /></Protected>} />
              <Route path="/ventas" element={<Protected><Ventas /></Protected>} />
              <Route path="/ventas/nueva" element={<Protected><NuevaVenta /></Protected>} />
              <Route path="/ventas/:id" element={<Protected><VentaDetalle /></Protected>} />
              <Route path="/clientes" element={<Protected><Clientes /></Protected>} />
              <Route path="/reportes" element={<Protected><Reportes /></Protected>} />
              <Route path="/reportes/dgii" element={<Protected><ReportesDGII /></Protected>} />
              <Route path="/configuracion" element={<Protected><Configuracion /></Protected>} />
              <Route path="/configuracion/ncf" element={<Protected><ConfiguracionNCF /></Protected>} />
              <Route path="/cuentas-por-pagar" element={<Protected><CuentasPorPagar /></Protected>} />
              <Route path="/proveedores" element={<Protected><Proveedores /></Protected>} />
              <Route path="/facturas" element={<Protected><Facturas /></Protected>} />
              <Route path="/facturas/:id" element={<Protected><FacturaDetalle /></Protected>} />
              <Route path="/cotizaciones" element={<Protected><Cotizaciones /></Protected>} />
              <Route path="/cotizaciones/nueva" element={<Protected><NuevaCotizacion /></Protected>} />
              <Route path="/cotizaciones/:id" element={<Protected><CotizacionDetalle /></Protected>} />
              <Route path="/gastos" element={<Protected><Gastos /></Protected>} />
              <Route path="/usuarios" element={<Protected><Usuarios /></Protected>} />
              <Route path="/empleados" element={<Protected><Empleados /></Protected>} />
              <Route path="/sugerencias" element={<Protected><Sugerencias /></Protected>} />
              <Route path="/cuadre" element={<Protected><CuadrePersonal /></Protected>} />
              <Route path="/admin" element={<Protected><Admin /></Protected>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
