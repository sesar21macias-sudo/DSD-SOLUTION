# NICE Seller Hub

Cada distribuidora NICE con su propia tienda digital, basada en el inventario
que de verdad tiene disponible. El cliente abre el enlace, arma su pedido y le
llega completo al WhatsApp de esa distribuidora.

**Producción:** https://nice-seller-hub.sesar21macias.workers.dev

---

## Cuentas de demostración

Contraseña de todas: `nicedemo2026`

| Cuenta | Correo | Tienda |
| --- | --- | --- |
| Ana García | `ana@nicehub.mx` | `/ana` — 15 piezas, Ciudad Juárez |
| María López | `maria@nicehub.mx` | `/maria` — 11 piezas, Monterrey |
| Carlos Rodríguez | `carlos@nicehub.mx` | `/carlos` — 8 piezas, Guadalajara |
| Administración | `admin@nicehub.mx` | `/admin` |

---

## Arquitectura

| Capa | Elección | Por qué |
| --- | --- | --- |
| Framework | Next.js 15 (App Router), React 19, TypeScript estricto | La tienda pública se renderiza en el servidor: llega con las fotos en el HTML y es indexable. |
| Estilos | Tailwind v4 | Paleta y tipografía definidas en `app/globals.css`. |
| Ejecución | Cloudflare Workers vía `@opennextjs/cloudflare` | Un solo despliegue, sin servidor que administrar. |
| Base de datos | Cloudflare D1 (SQLite) + Drizzle ORM | Relacional, migraciones versionadas en `migrations/`. |
| Sesión | PBKDF2-SHA256 + cookie HttpOnly firmada con HMAC | Nativo del runtime, sin dependencias ni servicio externo. |
| Carrito | React Context + `localStorage`, separado por slug de tienda | Un carrito nunca mezcla piezas de dos distribuidoras. |

### El aislamiento entre tiendas

Es la regla que sostiene todo lo demás y se aplica en cuatro capas:

1. **`middleware.ts`** bloquea `/dashboard` y `/admin` a quien no traiga sesión,
   y `/admin` a quien no sea admin. Falla cerrado: si la base no responde, no
   pasa nadie.
2. **`lib/session.ts`** es el único lugar que responde "quién está pidiendo
   esto". El `sellerId` sale de ahí; **jamás** del navegador.
3. **`lib/seller.ts` y `lib/mutations.ts`**: toda consulta y toda escritura
   recibe ese `sellerId` y lo mete en el `WHERE`. Un id ajeno no encuentra fila.
4. **`server-only`** marca los módulos que abren la base. Si un componente de
   cliente los importa, el build falla. (Ya atrapó dos fugas reales: `SaleForm`
   y `OrdersList` estaban enviando el código de D1 al navegador.)

### Decisiones que conviene conocer

- **El dinero se guarda en centavos enteros.** Nunca flotantes: los totales que
  se mandan por WhatsApp tienen que cuadrar con la suma de sus partidas.
- **Un pedido no descuenta inventario.** Es una intención de compra que todavía
  se confirma por WhatsApp. Si descontara, cualquiera podría dejar en ceros el
  inventario de una distribuidora sin comprarle nada. El stock baja al
  registrar la venta (`registerSale`), que es también donde se acumulan puntos.
- **El estado de una pieza se calcula, no se guarda.** *Disponible / Últimas
  piezas / Agotado* se derivan del stock; lo único que decide la persona es si
  la pieza se ve (`is_visible`).
- **El stock se revalida en el servidor** justo antes de generar el folio. El
  carrito vive en el navegador y puede llevar días abierto.
- **Los folios** `NICE-YYYYMMDD-NNNN` salen de un contador atómico
  (`order_counters`), no de un `count(*) + 1` que daría folios repetidos.
- **Los precios pertenecen al inventario, no al producto.** El mismo código
  NICE puede costar distinto con cada distribuidora.

---

## Desarrollo

```bash
npm install
npm run db:generate      # migraciones a partir de db/schema.ts
npm run db:local         # aplicarlas a la base local
node scripts/build-seed.mjs   # regenerar scripts/seed.sql
npm run db:seed:local    # cargar los datos de demostración
npm run dev
```

## Despliegue

```bash
npm run db:remote        # migraciones en la base de Cloudflare
npm run deploy           # build de OpenNext + subida del Worker
```

---

## Estructura

```
app/
  page.tsx                 portada, lista de tiendas
  login/ register/         alta y acceso
  [seller]/                LA TIENDA PÚBLICA
    page.tsx               catálogo con búsqueda y filtros
    product/[code]/        detalle de la pieza
    cart/ checkout/        carrito y confirmación
    order/[number]/        folio + botón de WhatsApp
  dashboard/               PANEL DE LA DISTRIBUIDORA
    inventory/ orders/ sales/ customers/ analytics/ qr/ settings/
    actions.ts             server actions (todas pasan por requireSeller)
  admin/                   panel de plataforma
  api/
    auth/                  login, registro, cierre de sesión
    stores/[slug]/orders/  creación de pedidos (público, con límite por IP)

lib/
  session.ts    de dónde sale el sellerId          [server-only]
  seller.ts     lecturas del panel, acotadas       [server-only]
  mutations.ts  escrituras del panel, acotadas     [server-only]
  store.ts      lecturas públicas de una tienda    [server-only]
  orders.ts     folios y creación de pedidos       [server-only]
  admin.ts      consultas de plataforma            [server-only]
  whatsapp.ts   el mensaje del pedido              (puro)
  inventory.ts  estados derivados del stock        (puro)
  format.ts     dinero, fechas, slugs              (puro)
  phone.ts      normalización a formato E.164      (puro)
```

---

## Lo que todavía no está

Fase 1 quedó completa. Pendientes deliberados:

- **Subida de imágenes.** Hoy se pega la URL de la foto. Falta un adaptador a
  R2 o Cloudflare Images; el resto ya está listo para recibirlo.
- **Recompensas y cupones.** Los puntos ya se acumulan por venta y por tienda,
  y las tablas existen; falta la interfaz para canjearlos (Fase 2).
- **Cuentas de cliente.** Hoy se compra como invitado. El pedido guarda su
  nombre y teléfono si los deja.
- **Pagos en línea.** El modelo separa pedido de venta justo para que Stripe o
  Mercado Pago entren después sin rehacer nada.
