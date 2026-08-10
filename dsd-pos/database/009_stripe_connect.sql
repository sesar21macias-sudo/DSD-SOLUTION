-- Permite que cada negocio conecte su propia cuenta de Stripe para que el
-- dinero de sus ventas le caiga directo a el, no a la cuenta central de DSD.
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS stripe_account_id varchar(64);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS stripe_onboarded boolean DEFAULT false;
