# Seguridad — dsd-pos

## Aislamiento multi-tenant: RLS vs. filtrado en backend

Las tablas de Supabase tienen `ENABLE ROW LEVEL SECURITY` (ver `database/001_schema.sql` y `database/006_audit_log.sql`) pero **sin políticas (`CREATE POLICY`) definidas**.

Esto es intencional por ahora, no un descuido: el backend (`backend/src/config/supabase.ts`) se conecta siempre con la `service_role` key de Supabase, que **bypassea RLS por diseño**. El sistema no usa Supabase Auth — usa JWT propio (`jsonwebtoken` + `JWT_SECRET`, ver `backend/src/middleware/auth.ts`). Como resultado:

- **El control real de aislamiento entre tenants vive en el código del backend**: cada query a Supabase debe filtrar explícitamente por `.eq('tenant_id', req.user!.tenantId)` (o el join correspondiente). Ese es el mecanismo que protege los datos hoy.
- Las políticas RLS, si se escribieran ahora, serían **inertes** — no hay forma de probarlas sin cambiar qué key/rol usa el backend, y escribir SQL que no se puede verificar agrega superficie de mantenimiento sin beneficio real.

### Qué se hizo (ronda de hardening de seguridad)

Se corrigieron varios puntos donde el filtrado por `tenant_id` faltaba o era insuficiente:
- IDOR en `removeOrderItem` (borraba items sin verificar tenant).
- IDOR en los endpoints públicos de MercadoPago (`createPreference`, `processCardPayment`) — ahora exigen `:tenantSlug` en la ruta y filtran la orden por ese tenant.
- `createProduct`/`updateProduct` no validaban que `category_id` perteneciera al tenant del usuario.
- Socket.io aceptaba cualquier `tenantId` del cliente sin validar contra el JWT — ahora el servidor autentica el socket y usa el `tenantId` del token, ignorando lo que mande el cliente.
- CORS estaba abierto a cualquier origen (`origin: true`) — ahora restringido a `FRONTEND_URL`.
- Rate limiting agregado en login y en los endpoints públicos de pago.
- Audit log mínimo (`audit_log`) para cancelaciones de orden, eliminación de items y cambios de rol de usuario.

### Qué se necesitaría para RLS real — evaluación (Fase 4)

Se evaluaron dos caminos para activar RLS de verdad. **Recomendación: Opción B**, no la migración completa a Supabase Auth.

**Opción A — Migrar a Supabase Auth (rechazada por ahora)**

Reemplazar el JWT propio por sesiones de Supabase Auth (`auth.users`, custom claims de `tenant_id`/`role`), y hacer que el frontend hable con Supabase directamente usando la key `anon`/`authenticated` en vez de pasar todo por el backend Express.

- **Alcance real**: toca `auth.controller.ts`, `middleware/auth.ts`, el store de auth del frontend (`useAuthStore`), la conexión de Socket.io, y requiere migrar cada usuario existente (`password_hash` propio con bcrypt → hash de Supabase Auth, que no es compatible directamente). Es un cambio transversal a toda la superficie de autenticación de un sistema que ya está en producción manejando pagos reales.
- **Beneficio real**: hoy el frontend *nunca* llama a Supabase directamente (todo pasa por el backend, confirmado en la auditoría de Fase 1) — así que RLS activo protegería contra un escenario que hoy no existe en la arquitectura (frontend hablando directo con la DB). El beneficio es preparación a futuro, no una vulnerabilidad activa hoy.
- **Riesgo**: alto. Sin suite de tests automatizados, un error en la migración de autenticación puede bloquear el login de todos los tenants en producción. Costo/beneficio desfavorable *ahora*.

**Opción B — RLS real sin migrar autenticación (recomendada, no implementada aún)**

Postgres permite políticas RLS basadas en una variable de sesión (`current_setting('app.tenant_id')`) sin necesidad de Supabase Auth:

1. Crear un rol de Postgres restringido (`app_tenant_role`) distinto de `service_role`, sin bypass de RLS.
2. El backend, en vez de usar siempre `service_role`, abriría una conexión/transacción como ese rol restringido para las queries de negocio (dejando `service_role` solo para tareas administrativas como seeds), ejecutando `SET LOCAL app.tenant_id = '<uuid-del-jwt-propio>'` al inicio de cada request autenticado.
3. Las políticas RLS quedan escritas contra esa variable: `USING (tenant_id::text = current_setting('app.tenant_id', true))`.
4. El JWT propio actual (`jsonwebtoken`) **no cambia** — RLS pasa a ser una segunda capa de defensa real (si algún día un query olvida el `.eq('tenant_id', ...)`, Postgres lo bloquea de todas formas), sin tocar login, sesiones, ni el frontend.

Esto sí requiere trabajo (cambiar cómo el backend abre conexiones a Postgres, escribir y *poder probar* ~12 políticas reales, ajustar el pool de conexiones de Supabase para soportar `SET LOCAL` por request), pero es un cambio acotado al backend, reversible, y no pone en riesgo el login de usuarios existentes. Es el candidato natural si se decide invertir en RLS real más adelante.

### Rotación de credenciales

Si alguna vez se expuso la `service_role` key de Supabase (en disco, en un commit, o compartida en una conversación), debe rotarse desde el dashboard de Supabase (Project Settings → API → regenerate service_role key) y actualizarse en todas las variables de entorno (`.env` local, Railway, etc.). Esa key tiene acceso total a la base de datos, sin restricciones de RLS.
