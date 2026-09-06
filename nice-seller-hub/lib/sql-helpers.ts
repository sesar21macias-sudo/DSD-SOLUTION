import { sql, type SQL } from "drizzle-orm";

/**
 * Referencia a una columna calificada con su tabla, para usarla dentro de una
 * subconsulta correlacionada.
 *
 * Hace falta porque al interpolar una columna de Drizzle dentro de una
 * plantilla `sql` cruda —`${schema.sellers.id}`— se genera `"id"` a secas, sin
 * el nombre de la tabla. Dentro de una subconsulta eso no da error: la columna
 * simplemente se resuelve contra la tabla de adentro, y la consulta devuelve
 * numeros que parecen validos pero no lo son. Fue exactamente el bug que hacia
 * que todas las tiendas mostraran las mismas piezas disponibles.
 *
 * Los nombres son constantes del esquema, nunca datos de nadie: no hay
 * superficie de inyeccion en `sql.raw` aqui.
 */
export function outer(table: string, column: string): SQL {
  return sql.raw(`"${table}"."${column}"`);
}
