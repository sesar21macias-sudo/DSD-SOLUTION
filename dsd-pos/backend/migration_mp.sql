-- Migración: soporte Mercado Pago
-- Ejecutar en Supabase Dashboard → SQL Editor

-- 1. Columnas de MP en la tabla orders
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS tip_amount      NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tip_percent     NUMERIC(5,2)  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mp_preference_id TEXT,
  ADD COLUMN IF NOT EXISTS mp_payment_id   TEXT;

-- 2. Columna mp_payment_id en payments (para referencia cruzada)
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS mp_payment_id TEXT;

-- 3. Credenciales de Mercado Pago por tenant
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS mp_access_token  TEXT,
  ADD COLUMN IF NOT EXISTS mp_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS mp_public_key    TEXT,
  ADD COLUMN IF NOT EXISTS mp_user_id       TEXT;
