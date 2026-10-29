-- 1. Agregar rol superadmin al enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'superadmin';
