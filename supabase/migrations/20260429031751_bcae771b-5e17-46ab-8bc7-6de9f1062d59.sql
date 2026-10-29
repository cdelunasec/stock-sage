-- Agregar columna de color primario a tenants
ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS color_primario text NOT NULL DEFAULT '#2563eb';

-- Bucket público para branding (logos)
INSERT INTO storage.buckets (id, name, public)
VALUES ('branding', 'branding', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas: lectura pública, escritura por usuarios autenticados de su tenant
CREATE POLICY "branding_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'branding');

CREATE POLICY "branding_tenant_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'branding'
  AND (storage.foldername(name))[1] = public.current_tenant_id()::text
);

CREATE POLICY "branding_tenant_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'branding'
  AND (storage.foldername(name))[1] = public.current_tenant_id()::text
);

CREATE POLICY "branding_tenant_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'branding'
  AND (storage.foldername(name))[1] = public.current_tenant_id()::text
);