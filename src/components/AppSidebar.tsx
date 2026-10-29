import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Package, Warehouse, ArrowLeftRight, ShoppingCart,
  Users, BarChart3, Settings, Boxes, Truck, FileText, Shield, Wrench, FileSignature, Receipt, UserCog, Briefcase, MessageSquare, Hash, CreditCard, Wallet,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const items = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Productos", url: "/productos", icon: Package },
  { title: "Servicios", url: "/servicios", icon: Wrench },
  { title: "Almacenes", url: "/almacenes", icon: Warehouse },
  { title: "Stock", url: "/stock", icon: ArrowLeftRight },
  { title: "Proveedores", url: "/proveedores", icon: Truck },
  { title: "Ventas", url: "/ventas", icon: ShoppingCart },
  { title: "Cotizaciones", url: "/cotizaciones", icon: FileSignature },
  { title: "Facturación", url: "/facturas", icon: FileText },
  { title: "Cuentas por Pagar", url: "/cuentas-por-pagar", icon: CreditCard },
  { title: "Gastos", url: "/gastos", icon: Receipt },
  { title: "Clientes", url: "/clientes", icon: Users },
  { title: "Cuadre Personal", url: "/cuadre", icon: Wallet },
  { title: "Reportes", url: "/reportes", icon: BarChart3 },
  { title: "Reportes DGII", url: "/reportes/dgii", icon: FileText },
  { title: "Secuencias NCF", url: "/configuracion/ncf", icon: Hash },
  { title: "Sugerencias", url: "/sugerencias", icon: MessageSquare },
  { title: "Configuración", url: "/configuracion", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { roles } = useAuth();
  const isSuperadmin = roles.includes("superadmin");

  const isAdmin = roles.includes("admin");

  let navItems = [...items];
  if (isAdmin && !isSuperadmin) {
    // Insertar Usuarios antes de Configuración
    const idx = navItems.findIndex((i) => i.url === "/configuracion");
    navItems.splice(idx, 0, { title: "Usuarios", url: "/usuarios", icon: UserCog });
    navItems.splice(idx + 1, 0, { title: "Empleados", url: "/empleados", icon: Briefcase });
  }
  if (isSuperadmin) {
    navItems = [...navItems, { title: "Administración SaaS", url: "/admin", icon: Shield }];
  }

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="border-b overflow-hidden">
        <div className={cn(
          "flex items-center py-2",
          collapsed ? "justify-center px-0 gap-0" : "gap-2 px-2"
        )}>
          <div className={cn(
            "flex shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground",
            collapsed ? "h-8 w-8" : "h-9 w-9"
          )}>
            <Boxes className={collapsed ? "h-4 w-4" : "h-5 w-5"} />
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold leading-tight truncate">DL-Stock</span>
              <span className="text-xs text-muted-foreground leading-tight truncate">Inventario</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegación</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const active = item.url === "/"
                  ? location.pathname === "/"
                  : location.pathname.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild tooltip={item.title}>
                      <NavLink
                        to={item.url}
                        end={item.url === "/"}
                        className={cn(
                          "flex items-center gap-3 rounded-md transition-colors",
                          active
                            ? "bg-accent text-accent-foreground font-medium"
                            : "hover:bg-muted/60",
                        )}
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
