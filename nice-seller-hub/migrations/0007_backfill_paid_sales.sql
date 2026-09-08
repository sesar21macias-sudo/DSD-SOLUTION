-- Toda venta que existia antes de los abonos estaba pagada por completo: se
-- registraban al momento de cobrar. Dejar `paid_cents` en 0 las mostraria a
-- todas como deuda pendiente el dia que se abra la pantalla de cobranza.
UPDATE sales SET paid_cents = total_cents WHERE paid_cents = 0;
