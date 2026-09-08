-- Las cuentas de lealtad que ya existian antes de que hubiera acumulado
-- historico se quedaron con lifetime_points en 0, y el nivel se calcula sobre
-- esa columna: sin este relleno, una clienta con 900 puntos aparecia como
-- NICE MEMBER en vez de su nivel real.
--
-- Se toma el saldo como acumulado porque es la mejor aproximacion que existe:
-- antes de esta version no habia canjes, asi que saldo e historico eran lo mismo.
UPDATE loyalty_accounts SET lifetime_points = points WHERE lifetime_points = 0 AND points > 0;
