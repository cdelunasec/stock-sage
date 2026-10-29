# DL-Stock

Sistema de inventario y facturación para negocios de República Dominicana, con
comprobantes fiscales (NCF) y reportes para la DGII.

- Productos, servicios, almacenes y movimientos de stock
- Ventas, cotizaciones y facturas con secuencias NCF
- Clientes, proveedores, órdenes de compra y cuentas por pagar
- Gastos, gastos recurrentes, empleados, asistencia y nómina
- Reportes DGII y reportes generales
- Varias empresas por cuenta (tenants), con usuarios y roles por empresa

Stack: React 18, Vite, TypeScript, Tailwind y shadcn/ui, con Supabase para auth, datos y
Edge Functions.

## Correrlo

```bash
npm install
cp .env.example .env   # VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY
npm run dev
```

Las tablas están en `supabase/migrations` y las funciones en `supabase/functions`.
