export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      almacenes: {
        Row: {
          activo: boolean
          created_at: string
          direccion: string | null
          id: string
          nombre: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          direccion?: string | null
          id?: string
          nombre: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          direccion?: string | null
          id?: string
          nombre?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "almacenes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      asistencia: {
        Row: {
          created_at: string
          empleado_id: string
          estado: string
          fecha: string
          hora_entrada: string | null
          hora_salida: string | null
          horas_trabajadas: number | null
          id: string
          notas: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          empleado_id: string
          estado?: string
          fecha?: string
          hora_entrada?: string | null
          hora_salida?: string | null
          horas_trabajadas?: number | null
          id?: string
          notas?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          empleado_id?: string
          estado?: string
          fecha?: string
          hora_entrada?: string | null
          hora_salida?: string | null
          horas_trabajadas?: number | null
          id?: string
          notas?: string | null
          tenant_id?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          accion: string
          created_at: string
          datos: Json | null
          entidad: string
          entidad_id: string | null
          id: string
          tenant_id: string
          user_id: string | null
        }
        Insert: {
          accion: string
          created_at?: string
          datos?: Json | null
          entidad: string
          entidad_id?: string | null
          id?: string
          tenant_id: string
          user_id?: string | null
        }
        Update: {
          accion?: string
          created_at?: string
          datos?: Json | null
          entidad?: string
          entidad_id?: string | null
          id?: string
          tenant_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias: {
        Row: {
          created_at: string
          descripcion: string | null
          id: string
          nombre: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categorias_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          created_at: string
          credito_disponible: number
          direccion: string | null
          email: string | null
          id: string
          identificador_fiscal: string | null
          ncf_tipo_default: Database["public"]["Enums"]["ncf_tipo"] | null
          nombre: string
          telefono: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          credito_disponible?: number
          direccion?: string | null
          email?: string | null
          id?: string
          identificador_fiscal?: string | null
          ncf_tipo_default?: Database["public"]["Enums"]["ncf_tipo"] | null
          nombre: string
          telefono?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          credito_disponible?: number
          direccion?: string | null
          email?: string | null
          id?: string
          identificador_fiscal?: string | null
          ncf_tipo_default?: Database["public"]["Enums"]["ncf_tipo"] | null
          nombre?: string
          telefono?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clientes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      cotizacion_items: {
        Row: {
          cantidad: number
          cotizacion_id: string
          created_at: string
          descripcion: string | null
          id: string
          impuesto_pct: number
          precio_unitario: number
          producto_id: string | null
          servicio_id: string | null
          subtotal: number
        }
        Insert: {
          cantidad: number
          cotizacion_id: string
          created_at?: string
          descripcion?: string | null
          id?: string
          impuesto_pct?: number
          precio_unitario: number
          producto_id?: string | null
          servicio_id?: string | null
          subtotal: number
        }
        Update: {
          cantidad?: number
          cotizacion_id?: string
          created_at?: string
          descripcion?: string | null
          id?: string
          impuesto_pct?: number
          precio_unitario?: number
          producto_id?: string | null
          servicio_id?: string | null
          subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: "cotizacion_items_cotizacion_id_fkey"
            columns: ["cotizacion_id"]
            isOneToOne: false
            referencedRelation: "cotizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      cotizaciones: {
        Row: {
          almacen_id: string
          cliente_id: string | null
          created_at: string
          estado: Database["public"]["Enums"]["cotizacion_estado"]
          fecha: string
          id: string
          impuesto: number
          notas: string | null
          numero: number
          subtotal: number
          tenant_id: string
          total: number
          updated_at: string
          user_id: string | null
          valida_hasta: string | null
          venta_id: string | null
        }
        Insert: {
          almacen_id: string
          cliente_id?: string | null
          created_at?: string
          estado?: Database["public"]["Enums"]["cotizacion_estado"]
          fecha?: string
          id?: string
          impuesto?: number
          notas?: string | null
          numero?: number
          subtotal?: number
          tenant_id: string
          total?: number
          updated_at?: string
          user_id?: string | null
          valida_hasta?: string | null
          venta_id?: string | null
        }
        Update: {
          almacen_id?: string
          cliente_id?: string | null
          created_at?: string
          estado?: Database["public"]["Enums"]["cotizacion_estado"]
          fecha?: string
          id?: string
          impuesto?: number
          notas?: string | null
          numero?: number
          subtotal?: number
          tenant_id?: string
          total?: number
          updated_at?: string
          user_id?: string | null
          valida_hasta?: string | null
          venta_id?: string | null
        }
        Relationships: []
      }
      empleados: {
        Row: {
          activo: boolean
          created_at: string
          departamento: string | null
          direccion: string | null
          documento: string | null
          email: string | null
          fecha_ingreso: string
          fecha_salida: string | null
          id: string
          nombre_completo: string
          notas: string | null
          puesto: string | null
          salario_base: number
          telefono: string | null
          tenant_id: string
          tipo_contrato: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          activo?: boolean
          created_at?: string
          departamento?: string | null
          direccion?: string | null
          documento?: string | null
          email?: string | null
          fecha_ingreso?: string
          fecha_salida?: string | null
          id?: string
          nombre_completo: string
          notas?: string | null
          puesto?: string | null
          salario_base?: number
          telefono?: string | null
          tenant_id: string
          tipo_contrato?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          activo?: boolean
          created_at?: string
          departamento?: string | null
          direccion?: string | null
          documento?: string | null
          email?: string | null
          fecha_ingreso?: string
          fecha_salida?: string | null
          id?: string
          nombre_completo?: string
          notas?: string | null
          puesto?: string | null
          salario_base?: number
          telefono?: string | null
          tenant_id?: string
          tipo_contrato?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      factura_items: {
        Row: {
          cantidad: number
          codigo: string | null
          created_at: string
          descripcion: string
          descuento_motivo: string | null
          descuento_pct: number
          factura_id: string
          id: string
          impuesto_pct: number
          precio_original: number | null
          precio_unitario: number
          presentacion: string | null
          producto_id: string | null
          subtotal: number
          unidad: string | null
        }
        Insert: {
          cantidad: number
          codigo?: string | null
          created_at?: string
          descripcion: string
          descuento_motivo?: string | null
          descuento_pct?: number
          factura_id: string
          id?: string
          impuesto_pct?: number
          precio_original?: number | null
          precio_unitario: number
          presentacion?: string | null
          producto_id?: string | null
          subtotal: number
          unidad?: string | null
        }
        Update: {
          cantidad?: number
          codigo?: string | null
          created_at?: string
          descripcion?: string
          descuento_motivo?: string | null
          descuento_pct?: number
          factura_id?: string
          id?: string
          impuesto_pct?: number
          precio_original?: number | null
          precio_unitario?: number
          presentacion?: string | null
          producto_id?: string | null
          subtotal?: number
          unidad?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "factura_items_factura_id_fkey"
            columns: ["factura_id"]
            isOneToOne: false
            referencedRelation: "facturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factura_items_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      facturas: {
        Row: {
          atendido_por_nombre: string | null
          cliente_id: string | null
          condicion_pago: string
          correlativo: number
          created_at: string
          created_by_email: string | null
          datos_cliente: Json | null
          datos_emisor: Json | null
          descuento: number
          eliminada_en: string | null
          eliminada_por: string | null
          estado: string
          fecha_emision: string
          fecha_vencimiento: string | null
          id: string
          impuesto: number
          metodo_pago: string | null
          motivo_eliminacion: string | null
          ncf: string | null
          ncf_tipo: Database["public"]["Enums"]["ncf_tipo"] | null
          notas: string | null
          numero_factura: string | null
          serie: string
          subtotal: number
          tenant_id: string
          total: number
          updated_at: string
          user_id: string | null
          venta_id: string | null
        }
        Insert: {
          atendido_por_nombre?: string | null
          cliente_id?: string | null
          condicion_pago?: string
          correlativo: number
          created_at?: string
          created_by_email?: string | null
          datos_cliente?: Json | null
          datos_emisor?: Json | null
          descuento?: number
          eliminada_en?: string | null
          eliminada_por?: string | null
          estado?: string
          fecha_emision?: string
          fecha_vencimiento?: string | null
          id?: string
          impuesto?: number
          metodo_pago?: string | null
          motivo_eliminacion?: string | null
          ncf?: string | null
          ncf_tipo?: Database["public"]["Enums"]["ncf_tipo"] | null
          notas?: string | null
          numero_factura?: string | null
          serie?: string
          subtotal?: number
          tenant_id: string
          total?: number
          updated_at?: string
          user_id?: string | null
          venta_id?: string | null
        }
        Update: {
          atendido_por_nombre?: string | null
          cliente_id?: string | null
          condicion_pago?: string
          correlativo?: number
          created_at?: string
          created_by_email?: string | null
          datos_cliente?: Json | null
          datos_emisor?: Json | null
          descuento?: number
          eliminada_en?: string | null
          eliminada_por?: string | null
          estado?: string
          fecha_emision?: string
          fecha_vencimiento?: string | null
          id?: string
          impuesto?: number
          metodo_pago?: string | null
          motivo_eliminacion?: string | null
          ncf?: string | null
          ncf_tipo?: Database["public"]["Enums"]["ncf_tipo"] | null
          notas?: string | null
          numero_factura?: string | null
          serie?: string
          subtotal?: number
          tenant_id?: string
          total?: number
          updated_at?: string
          user_id?: string | null
          venta_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "facturas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facturas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facturas_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "ventas"
            referencedColumns: ["id"]
          },
        ]
      }
      gastos: {
        Row: {
          categoria: string | null
          concepto: string
          created_at: string
          fecha: string
          id: string
          metodo_pago: string | null
          monto: number
          notas: string | null
          proveedor_id: string | null
          recurrente_id: string | null
          tenant_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          categoria?: string | null
          concepto: string
          created_at?: string
          fecha?: string
          id?: string
          metodo_pago?: string | null
          monto?: number
          notas?: string | null
          proveedor_id?: string | null
          recurrente_id?: string | null
          tenant_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          categoria?: string | null
          concepto?: string
          created_at?: string
          fecha?: string
          id?: string
          metodo_pago?: string | null
          monto?: number
          notas?: string | null
          proveedor_id?: string | null
          recurrente_id?: string | null
          tenant_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gastos_recurrente_id_fkey"
            columns: ["recurrente_id"]
            isOneToOne: false
            referencedRelation: "gastos_recurrentes"
            referencedColumns: ["id"]
          },
        ]
      }
      gastos_recurrentes: {
        Row: {
          activo: boolean
          categoria: string | null
          concepto: string
          created_at: string
          dia_mes: number | null
          frecuencia: Database["public"]["Enums"]["gasto_frecuencia"]
          id: string
          monto: number
          notas: string | null
          proveedor_id: string | null
          proximo_vencimiento: string
          tenant_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          activo?: boolean
          categoria?: string | null
          concepto: string
          created_at?: string
          dia_mes?: number | null
          frecuencia?: Database["public"]["Enums"]["gasto_frecuencia"]
          id?: string
          monto?: number
          notas?: string | null
          proveedor_id?: string | null
          proximo_vencimiento: string
          tenant_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          activo?: boolean
          categoria?: string | null
          concepto?: string
          created_at?: string
          dia_mes?: number | null
          frecuencia?: Database["public"]["Enums"]["gasto_frecuencia"]
          id?: string
          monto?: number
          notas?: string | null
          proveedor_id?: string | null
          proximo_vencimiento?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      ncf_secuencias: {
        Row: {
          activo: boolean
          created_at: string
          fecha_vencimiento: string | null
          id: string
          prefijo: string
          secuencia_actual: number
          secuencia_desde: number
          secuencia_hasta: number
          tenant_id: string
          tipo: Database["public"]["Enums"]["ncf_tipo"]
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          fecha_vencimiento?: string | null
          id?: string
          prefijo: string
          secuencia_actual: number
          secuencia_desde: number
          secuencia_hasta: number
          tenant_id: string
          tipo: Database["public"]["Enums"]["ncf_tipo"]
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          fecha_vencimiento?: string | null
          id?: string
          prefijo?: string
          secuencia_actual?: number
          secuencia_desde?: number
          secuencia_hasta?: number
          tenant_id?: string
          tipo?: Database["public"]["Enums"]["ncf_tipo"]
          updated_at?: string
        }
        Relationships: []
      }
      orden_compra_items: {
        Row: {
          cantidad: number
          created_at: string
          descripcion: string
          id: string
          impuesto_pct: number
          orden_id: string
          precio_unitario: number
          producto_id: string | null
          subtotal: number
        }
        Insert: {
          cantidad: number
          created_at?: string
          descripcion: string
          id?: string
          impuesto_pct?: number
          orden_id: string
          precio_unitario: number
          producto_id?: string | null
          subtotal: number
        }
        Update: {
          cantidad?: number
          created_at?: string
          descripcion?: string
          id?: string
          impuesto_pct?: number
          orden_id?: string
          precio_unitario?: number
          producto_id?: string | null
          subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: "orden_compra_items_orden_id_fkey"
            columns: ["orden_id"]
            isOneToOne: false
            referencedRelation: "ordenes_compra"
            referencedColumns: ["id"]
          },
        ]
      }
      ordenes_compra: {
        Row: {
          almacen_id: string | null
          condicion_pago: string
          created_at: string
          estado: Database["public"]["Enums"]["oc_estado"]
          fecha: string
          fecha_vencimiento: string | null
          id: string
          impuesto: number
          ncf: string | null
          notas: string | null
          numero: number
          proveedor_id: string
          saldo: number
          subtotal: number
          tenant_id: string
          total: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          almacen_id?: string | null
          condicion_pago?: string
          created_at?: string
          estado?: Database["public"]["Enums"]["oc_estado"]
          fecha?: string
          fecha_vencimiento?: string | null
          id?: string
          impuesto?: number
          ncf?: string | null
          notas?: string | null
          numero?: number
          proveedor_id: string
          saldo?: number
          subtotal?: number
          tenant_id: string
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          almacen_id?: string | null
          condicion_pago?: string
          created_at?: string
          estado?: Database["public"]["Enums"]["oc_estado"]
          fecha?: string
          fecha_vencimiento?: string | null
          id?: string
          impuesto?: number
          ncf?: string | null
          notas?: string | null
          numero?: number
          proveedor_id?: string
          saldo?: number
          subtotal?: number
          tenant_id?: string
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      pagos_nomina: {
        Row: {
          bonificaciones: number
          created_at: string
          deducciones: number
          empleado_id: string
          estado: string
          fecha_pago: string
          gasto_id: string | null
          id: string
          metodo_pago: string | null
          notas: string | null
          periodo_fin: string
          periodo_inicio: string
          salario_base: number
          tenant_id: string
          total: number
        }
        Insert: {
          bonificaciones?: number
          created_at?: string
          deducciones?: number
          empleado_id: string
          estado?: string
          fecha_pago?: string
          gasto_id?: string | null
          id?: string
          metodo_pago?: string | null
          notas?: string | null
          periodo_fin: string
          periodo_inicio: string
          salario_base?: number
          tenant_id: string
          total?: number
        }
        Update: {
          bonificaciones?: number
          created_at?: string
          deducciones?: number
          empleado_id?: string
          estado?: string
          fecha_pago?: string
          gasto_id?: string | null
          id?: string
          metodo_pago?: string | null
          notas?: string | null
          periodo_fin?: string
          periodo_inicio?: string
          salario_base?: number
          tenant_id?: string
          total?: number
        }
        Relationships: []
      }
      pagos_proveedor: {
        Row: {
          created_at: string
          fecha: string
          id: string
          metodo_pago: string | null
          monto: number
          notas: string | null
          orden_id: string
          tenant_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          fecha?: string
          id?: string
          metodo_pago?: string | null
          monto: number
          notas?: string | null
          orden_id: string
          tenant_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          fecha?: string
          id?: string
          metodo_pago?: string | null
          monto?: number
          notas?: string | null
          orden_id?: string
          tenant_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pagos_proveedor_orden_id_fkey"
            columns: ["orden_id"]
            isOneToOne: false
            referencedRelation: "ordenes_compra"
            referencedColumns: ["id"]
          },
        ]
      }
      producto_proveedores: {
        Row: {
          codigo_proveedor: string | null
          created_at: string
          id: string
          precio_compra: number | null
          producto_id: string
          proveedor_id: string
          tenant_id: string
        }
        Insert: {
          codigo_proveedor?: string | null
          created_at?: string
          id?: string
          precio_compra?: number | null
          producto_id: string
          proveedor_id: string
          tenant_id: string
        }
        Update: {
          codigo_proveedor?: string | null
          created_at?: string
          id?: string
          precio_compra?: number | null
          producto_id?: string
          proveedor_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "producto_proveedores_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producto_proveedores_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producto_proveedores_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      productos: {
        Row: {
          activo: boolean
          categoria_id: string | null
          codigo_barras: string | null
          created_at: string
          descripcion: string | null
          id: string
          imagen_url: string | null
          impuesto_pct: number
          nombre: string
          permite_venta_empaque: boolean
          precio_costo: number
          precio_venta: number
          sku: string
          stock_minimo: number
          tenant_id: string
          unidad: string
          unidad_empaque: string | null
          unidades_por_empaque: number | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          categoria_id?: string | null
          codigo_barras?: string | null
          created_at?: string
          descripcion?: string | null
          id?: string
          imagen_url?: string | null
          impuesto_pct?: number
          nombre: string
          permite_venta_empaque?: boolean
          precio_costo?: number
          precio_venta?: number
          sku: string
          stock_minimo?: number
          tenant_id: string
          unidad?: string
          unidad_empaque?: string | null
          unidades_por_empaque?: number | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          categoria_id?: string | null
          codigo_barras?: string | null
          created_at?: string
          descripcion?: string | null
          id?: string
          imagen_url?: string | null
          impuesto_pct?: number
          nombre?: string
          permite_venta_empaque?: boolean
          precio_costo?: number
          precio_venta?: number
          sku?: string
          stock_minimo?: number
          tenant_id?: string
          unidad?: string
          unidad_empaque?: string | null
          unidades_por_empaque?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "productos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "productos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          nombre_completo: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          nombre_completo?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          nombre_completo?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      proveedores: {
        Row: {
          activo: boolean
          condiciones_pago: string | null
          contacto: string | null
          created_at: string
          direccion: string | null
          email: string | null
          id: string
          identificador_fiscal: string | null
          nombre: string
          notas: string | null
          telefono: string | null
          tenant_id: string
          tipo_proveedor_id: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          condiciones_pago?: string | null
          contacto?: string | null
          created_at?: string
          direccion?: string | null
          email?: string | null
          id?: string
          identificador_fiscal?: string | null
          nombre: string
          notas?: string | null
          telefono?: string | null
          tenant_id: string
          tipo_proveedor_id?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          condiciones_pago?: string | null
          contacto?: string | null
          created_at?: string
          direccion?: string | null
          email?: string | null
          id?: string
          identificador_fiscal?: string | null
          nombre?: string
          notas?: string | null
          telefono?: string | null
          tenant_id?: string
          tipo_proveedor_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proveedores_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proveedores_tipo_proveedor_id_fkey"
            columns: ["tipo_proveedor_id"]
            isOneToOne: false
            referencedRelation: "tipos_proveedor"
            referencedColumns: ["id"]
          },
        ]
      }
      servicios: {
        Row: {
          activo: boolean
          created_at: string
          descripcion: string | null
          id: string
          impuesto_pct: number
          nombre: string
          precio: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          descripcion?: string | null
          id?: string
          impuesto_pct?: number
          nombre: string
          precio?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          descripcion?: string | null
          id?: string
          impuesto_pct?: number
          nombre?: string
          precio?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      stock_levels: {
        Row: {
          almacen_id: string
          cantidad: number
          id: string
          producto_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          almacen_id: string
          cantidad?: number
          id?: string
          producto_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          almacen_id?: string
          cantidad?: number
          id?: string
          producto_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_levels_almacen_id_fkey"
            columns: ["almacen_id"]
            isOneToOne: false
            referencedRelation: "almacenes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_levels_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_levels_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          almacen_destino_id: string | null
          almacen_id: string
          cantidad: number
          costo_unitario: number | null
          created_at: string
          created_by_email: string | null
          id: string
          notas: string | null
          producto_id: string
          proveedor_id: string | null
          referencia: string | null
          tenant_id: string
          tipo: Database["public"]["Enums"]["movimiento_tipo"]
          user_id: string | null
        }
        Insert: {
          almacen_destino_id?: string | null
          almacen_id: string
          cantidad: number
          costo_unitario?: number | null
          created_at?: string
          created_by_email?: string | null
          id?: string
          notas?: string | null
          producto_id: string
          proveedor_id?: string | null
          referencia?: string | null
          tenant_id: string
          tipo: Database["public"]["Enums"]["movimiento_tipo"]
          user_id?: string | null
        }
        Update: {
          almacen_destino_id?: string | null
          almacen_id?: string
          cantidad?: number
          costo_unitario?: number | null
          created_at?: string
          created_by_email?: string | null
          id?: string
          notas?: string | null
          producto_id?: string
          proveedor_id?: string | null
          referencia?: string | null
          tenant_id?: string
          tipo?: Database["public"]["Enums"]["movimiento_tipo"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_almacen_destino_id_fkey"
            columns: ["almacen_destino_id"]
            isOneToOne: false
            referencedRelation: "almacenes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_almacen_id_fkey"
            columns: ["almacen_id"]
            isOneToOne: false
            referencedRelation: "almacenes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          max_almacenes: number
          max_productos: number
          max_usuarios: number
          plan: Database["public"]["Enums"]["plan_tipo"]
          status: Database["public"]["Enums"]["subscription_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          max_almacenes?: number
          max_productos?: number
          max_usuarios?: number
          plan?: Database["public"]["Enums"]["plan_tipo"]
          status?: Database["public"]["Enums"]["subscription_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          max_almacenes?: number
          max_productos?: number
          max_usuarios?: number
          plan?: Database["public"]["Enums"]["plan_tipo"]
          status?: Database["public"]["Enums"]["subscription_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sugerencias: {
        Row: {
          asunto: string
          created_at: string
          estado: Database["public"]["Enums"]["sugerencia_estado"]
          id: string
          mensaje: string
          respondida_en: string | null
          respondida_por: string | null
          respuesta: string | null
          tenant_id: string
          tipo: Database["public"]["Enums"]["sugerencia_tipo"]
          updated_at: string
          user_id: string
        }
        Insert: {
          asunto: string
          created_at?: string
          estado?: Database["public"]["Enums"]["sugerencia_estado"]
          id?: string
          mensaje: string
          respondida_en?: string | null
          respondida_por?: string | null
          respuesta?: string | null
          tenant_id: string
          tipo?: Database["public"]["Enums"]["sugerencia_tipo"]
          updated_at?: string
          user_id: string
        }
        Update: {
          asunto?: string
          created_at?: string
          estado?: Database["public"]["Enums"]["sugerencia_estado"]
          id?: string
          mensaje?: string
          respondida_en?: string | null
          respondida_por?: string | null
          respuesta?: string | null
          tenant_id?: string
          tipo?: Database["public"]["Enums"]["sugerencia_tipo"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tenants: {
        Row: {
          color_primario: string
          created_at: string
          direccion: string | null
          email: string | null
          id: string
          identificador_fiscal: string | null
          logo_url: string | null
          moneda: string
          nombre: string
          pie_factura: string | null
          razon_social: string | null
          serie_factura: string
          siguiente_correlativo: number
          telefono: string | null
          updated_at: string
        }
        Insert: {
          color_primario?: string
          created_at?: string
          direccion?: string | null
          email?: string | null
          id?: string
          identificador_fiscal?: string | null
          logo_url?: string | null
          moneda?: string
          nombre: string
          pie_factura?: string | null
          razon_social?: string | null
          serie_factura?: string
          siguiente_correlativo?: number
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          color_primario?: string
          created_at?: string
          direccion?: string | null
          email?: string | null
          id?: string
          identificador_fiscal?: string | null
          logo_url?: string | null
          moneda?: string
          nombre?: string
          pie_factura?: string | null
          razon_social?: string | null
          serie_factura?: string
          siguiente_correlativo?: number
          telefono?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tipos_proveedor: {
        Row: {
          created_at: string
          id: string
          nombre: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          nombre: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          nombre?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tipos_proveedor_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      venta_items: {
        Row: {
          cantidad: number
          created_at: string
          descripcion: string | null
          descuento_motivo: string | null
          descuento_pct: number
          id: string
          impuesto_pct: number
          precio_original: number | null
          precio_unitario: number
          producto_id: string | null
          servicio_id: string | null
          subtotal: number
          venta_id: string
        }
        Insert: {
          cantidad: number
          created_at?: string
          descripcion?: string | null
          descuento_motivo?: string | null
          descuento_pct?: number
          id?: string
          impuesto_pct?: number
          precio_original?: number | null
          precio_unitario: number
          producto_id?: string | null
          servicio_id?: string | null
          subtotal: number
          venta_id: string
        }
        Update: {
          cantidad?: number
          created_at?: string
          descripcion?: string | null
          descuento_motivo?: string | null
          descuento_pct?: number
          id?: string
          impuesto_pct?: number
          precio_original?: number | null
          precio_unitario?: number
          producto_id?: string | null
          servicio_id?: string | null
          subtotal?: number
          venta_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venta_items_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venta_items_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "ventas"
            referencedColumns: ["id"]
          },
        ]
      }
      ventas: {
        Row: {
          almacen_id: string
          atendido_por_nombre: string | null
          cliente_id: string | null
          created_at: string
          created_by_email: string | null
          devolver_stock: boolean | null
          eliminada_en: string | null
          eliminada_por: string | null
          estado: Database["public"]["Enums"]["venta_estado"]
          id: string
          impuesto: number
          motivo_eliminacion: string | null
          notas: string | null
          numero: number
          subtotal: number
          tenant_id: string
          total: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          almacen_id: string
          atendido_por_nombre?: string | null
          cliente_id?: string | null
          created_at?: string
          created_by_email?: string | null
          devolver_stock?: boolean | null
          eliminada_en?: string | null
          eliminada_por?: string | null
          estado?: Database["public"]["Enums"]["venta_estado"]
          id?: string
          impuesto?: number
          motivo_eliminacion?: string | null
          notas?: string | null
          numero?: number
          subtotal?: number
          tenant_id: string
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          almacen_id?: string
          atendido_por_nombre?: string | null
          cliente_id?: string | null
          created_at?: string
          created_by_email?: string | null
          devolver_stock?: boolean | null
          eliminada_en?: string | null
          eliminada_por?: string | null
          estado?: Database["public"]["Enums"]["venta_estado"]
          id?: string
          impuesto?: number
          motivo_eliminacion?: string | null
          notas?: string | null
          numero?: number
          subtotal?: number
          tenant_id?: string
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ventas_almacen_id_fkey"
            columns: ["almacen_id"]
            isOneToOne: false
            referencedRelation: "almacenes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      actualizar_atendido_factura: {
        Args: { _factura_id: string; _nombre: string }
        Returns: undefined
      }
      actualizar_atendido_venta: {
        Args: { _nombre: string; _venta_id: string }
        Returns: undefined
      }
      can_manage: { Args: never; Returns: boolean }
      current_tenant_id: { Args: never; Returns: string }
      eliminar_factura: {
        Args: { _factura_id: string; _motivo: string }
        Returns: undefined
      }
      eliminar_venta: {
        Args: { _devolver_stock: boolean; _motivo: string; _venta_id: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_superadmin: { Args: never; Returns: boolean }
      log_audit: {
        Args: {
          _accion: string
          _datos?: Json
          _entidad: string
          _entidad_id: string
        }
        Returns: string
      }
      my_access_state: {
        Args: never
        Returns: {
          allows_access: boolean
          allows_writes: boolean
          expires_at: string
          status: string
        }[]
      }
      next_factura_correlativo: {
        Args: { _tenant_id: string }
        Returns: number
      }
      next_ncf: {
        Args: {
          _tenant_id: string
          _tipo: Database["public"]["Enums"]["ncf_tipo"]
        }
        Returns: string
      }
      registrar_pago_proveedor: {
        Args: {
          _fecha: string
          _metodo: string
          _monto: number
          _notas: string
          _orden_id: string
        }
        Returns: string
      }
      subscription_allows_access: {
        Args: { _tenant_id: string }
        Returns: boolean
      }
      subscription_allows_writes: {
        Args: { _tenant_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "supervisor" | "empleado" | "superadmin"
      cotizacion_estado:
        | "borrador"
        | "enviada"
        | "aceptada"
        | "rechazada"
        | "convertida"
        | "vencida"
      gasto_frecuencia: "mensual" | "semanal" | "quincenal" | "anual"
      movimiento_tipo:
        | "entrada"
        | "salida"
        | "ajuste"
        | "transferencia"
        | "venta"
        | "devolucion"
      ncf_tipo: "B01" | "B02" | "B14" | "B15"
      oc_estado:
        | "borrador"
        | "recibida"
        | "pagada_parcial"
        | "pagada"
        | "anulada"
      plan_tipo: "basico" | "profesional" | "empresarial"
      subscription_status: "activa" | "vencida" | "cancelada" | "prueba"
      sugerencia_estado: "abierta" | "en_revision" | "respondida" | "cerrada"
      sugerencia_tipo: "sugerencia" | "nota" | "reporte_bug" | "pregunta"
      venta_estado: "completada" | "devuelta" | "anulada" | "eliminada"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "supervisor", "empleado", "superadmin"],
      cotizacion_estado: [
        "borrador",
        "enviada",
        "aceptada",
        "rechazada",
        "convertida",
        "vencida",
      ],
      gasto_frecuencia: ["mensual", "semanal", "quincenal", "anual"],
      movimiento_tipo: [
        "entrada",
        "salida",
        "ajuste",
        "transferencia",
        "venta",
        "devolucion",
      ],
      ncf_tipo: ["B01", "B02", "B14", "B15"],
      oc_estado: [
        "borrador",
        "recibida",
        "pagada_parcial",
        "pagada",
        "anulada",
      ],
      plan_tipo: ["basico", "profesional", "empresarial"],
      subscription_status: ["activa", "vencida", "cancelada", "prueba"],
      sugerencia_estado: ["abierta", "en_revision", "respondida", "cerrada"],
      sugerencia_tipo: ["sugerencia", "nota", "reporte_bug", "pregunta"],
      venta_estado: ["completada", "devuelta", "anulada", "eliminada"],
    },
  },
} as const
