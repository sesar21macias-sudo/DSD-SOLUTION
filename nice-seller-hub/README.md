# DSD Seller Hub

Cada distribuidora NICE con su propia tienda digital, basada en el inventario
que de verdad tiene disponible. El cliente abre el enlace, arma su pedido y le
llega completo al WhatsApp de esa distribuidora.

**Producción:** https://nice-seller-hub.sesar21macias.workers.dev

---

## Estado: piloto, no abierto al público

La base de producción **no tiene datos de demostración**. Se vació el
2026-09-06 con `scripts/reset-demo.sql`, conservando las categorías, las cinco
piezas traídas del catálogo real de NICE y la cuenta de administración.

Para arrancar, cada distribuidora se da de alta en `/register` o se le crea la
cuenta a mano — mientras no exista "olvidé mi contraseña", crearlas tú evita
que alguien quede fuera.

### Cambiar la contraseña de una cuenta

Mientras no haya recuperación por correo, esta es la forma. La contraseña se
teclea en la terminal: no se pasa como argumento ni queda en el historial.

```bash
node scripts/set-password.mjs --remote
```

### Volver a poner datos de prueba (solo en local)

```bash
npm run db:seed:local
```

Las cuentas del seed usan la contraseña `nicedemo2026`. **Nunca lo cargues en
producción.**

--- | --- | --- |
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

Y una quinta que no es técnica sino de producto: **no existe ningún directorio
público de tiendas**. La portada le habla a una distribuidora que va a crear la
suya; no lista las que ya hay. Ponerlas juntas convertiría la plataforma en un
aparador donde compiten entre ellas por la misma clienta —lo contrario de la
premisa— y dejaría a la vista de cualquiera quién vende, en qué ciudad y cuánto
inventario tiene. Una clienta llega por el enlace o el QR que su distribuidora
le compartió. El único lugar donde se ven todas juntas es `/admin`.

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
- **Un costo desconocido es nulo, nunca cero.** Un cero diría que la pieza salió
  gratis e inflaría toda la ganancia; el nulo se reporta aparte.
- **En `app/dashboard/` no va un `loading.tsx`.** Hubo uno y dejaba el panel
  muerto en cualquier carga directa: el límite de Suspense que crea se servía
  pospuesto (`$~` en el HTML) y el cliente nunca lo resolvía, así que React
  hidrataba el menú pero no el contenido. La página se veía perfecta y ningún
  botón respondía. Navegando dentro del panel sí funcionaba —el contenido se
  pinta en el cliente—, por eso tardó tanto en salir. Si algún día se quiere un
  esqueleto de carga, hay que comprobar antes que el contenido siga hidratando
  al recargar.
- **El margen se calcula solo sobre lo costeado.** Dividir la ganancia entre el
  valor de todo el inventario mete en el divisor piezas que no aportan al
  numerador y devuelve un margen muy por debajo del real.
- **Una reserva no baja el stock.** Apartar una pieza cambia cuántas están
  disponibles *para alguien más*, no cuántas tiene ella. Y siempre vence.
- **Una venta a abonos sí descuenta inventario.** La pieza está apartada; lo que
  queda abierto es el cobro. El saldo se deriva del detalle de abonos y nunca se
  guarda como campo.

---

## Recepción de mercancía (foto del ticket)

`/dashboard/inventory/receive` — la distribuidora fotografía su ticket NICE y
las piezas entran a su inventario sin teclear un código.

**El flujo, y por qué tiene esa forma:**

```
Foto → se comprime en el teléfono → visión (Claude) → códigos + cantidades
     → se buscan en el catálogo global → BORRADOR
     → la persona revisa y corrige → Confirmar → inventario
```

- **El OCR nunca escribe en el inventario.** Crea una recepción en `draft`. El
  reconocimiento se equivoca —papel térmico, dígitos que se parecen— y un
  inventario mal cargado es peor que no tener la función: lo que se publica en
  la tienda deja de ser cierto.
- **La foto se comprime a 1600 px en el navegador** antes de subirla. Una foto
  de cámara pesa 4-8 MB y tarda una eternidad en datos móviles; el ticket sigue
  siendo legible a 300 KB. Se respeta la orientación EXIF, o el ticket llegaría
  acostado.
- **La foto no se guarda.** Una vez extraídos los códigos ya no aporta nada.

**Lo que el ticket real enseñó** (orden PD38-4944698, Guadalajara):

| Detalle del ticket | Cómo se maneja |
| --- | --- |
| La columna se llama **Id Nice** | Va literal en el prompt |
| Cantidad impresa como `1.000` | Regla explícita: es 1 pieza, no mil |
| Trae **Precio Catálogo** (`$319.00`) | Se extrae y prellena el precio |
| La descripción (`ARETES`) va en el **renglón de abajo** | Se asocia al código de arriba |
| Trae **TOTAL ARTICULOS** | Se compara con lo leído y se avisa si no cuadra |
| El último carácter del Id Nice puede ser `1`, `I` o `L` | Ver abajo |

**La ambigüedad `1`/`I`/`L`.** Es la falla más común de todo el flujo: en papel
térmico esos tres caracteres son casi idénticos, y muchos Id Nice terminan en
letra de variante. El sistema hace tres cosas: el prompt pide marcar esos
renglones como dudosos; si el código exacto no existe, se busca por *clave
normalizada* (`O`/`Q`→`0`, `I`/`L`→`1`) y se acepta **solo si un único producto
del catálogo coincide** —si dos coinciden, se deja sin resolver, porque la pieza
equivocada es peor que un "no encontrado"—; y un código resuelto así nunca se
marca como confiable: la revisión muestra el renglón crudo para cotejarlo con el
papel.

### La foto viene del catálogo de NICE

Sin foto, una pieza de joyería no se vende — y pedirle a la distribuidora que
suba veinte fotos anula el ahorro de escanear el ticket. Así que el código se
resuelve contra la tienda oficial, `niceonline.com`:

1. Se busca el código en `/mx/search`. La búsqueda de la tienda es difusa y
   devuelve quince resultados: **el primero no se acepta por ser el primero**.
2. Se abre la ficha de los candidatos y se lee su JSON-LD (`schema.org/Product`),
   que trae `sku`. Solo se acepta cuando ese `sku` coincide con el código o con
   una de sus variantes. Es la única forma de no colgarle a una pieza la foto de
   otra.
3. Lo encontrado se guarda en el **catálogo global**. La segunda vez que
   cualquier distribuidora reciba esa pieza, ya no cuesta una consulta.

**Y de paso resuelve la ambigüedad del papel.** Buscar "9250941" en NICE no
devuelve nada —ese código no existe—, así que si el último carácter es de los
dudosos se busca también sin él: "925094" sí encuentra la pieza, cuyo `sku` real
es "925094L". NICE es la autoridad sobre su propio catálogo, así que ese `sku`
gana sobre lo que se leyó del papel. Una consulta por tronco cubre todas las
variantes del último carácter en lugar de una petición por cada una.

Verificado en producción con los cinco códigos del ticket:

| Leído del papel | Resuelto | Pieza | Precio |
| --- | --- | --- | --- |
| `9250941` | `925094L` | Aretes arracada rectangular con baño de oro… | $319 |
| `925181` | `925181` | Aretes pequeños tipo botón con piedras de colores | $279 |
| `9254851` | `925485L` | Aretes tipo arracada con baño de rodio | $249 |
| `9256361` | `925636L` | Aretes Huggie con textura tipo malla | $319 |
| `9256551` | `925655L` | Aretes Huggie con acabado acanalado | $259 |

Los precios coinciden exactamente con el "Precio Catálogo" impreso en el ticket.

El mismo resolvedor alimenta el alta manual: en `/dashboard/inventory/new`, al
escribir el código se llenan solos el nombre, la foto, la categoría y el precio.

**Límites y consideraciones**

- Se consultan hasta **5 códigos desconocidos** por recepción, porque cada uno
  cuesta varias subpeticiones y un Worker las tiene contadas. Lo que quede fuera
  aparece con un botón *Buscar en NICE*; y como el catálogo es compartido, el
  costo tiende a cero con el uso.
- El `robots.txt` de niceonline.com permite `/search` y `/products/`; solo
  bloquea carrito, cuenta y checkout, que aquí no se tocan. Las peticiones van
  identificadas con un User-Agent propio.
- **Las imágenes se enlazan a su CDN, no se copian.** Eso evita redistribuir
  material de NICE, pero consume ancho de banda suyo y depende de que esa URL
  siga viva. Si NICE lo autoriza, el siguiente paso natural es copiarlas a R2.
- **Esto no es una API oficial ni un acuerdo con NICE.** Es lectura de páginas
  públicas de su tienda. Antes de operarlo en serio, conviene confirmarlo con
  ellos; si prefieren que no, el flujo sigue funcionando con las fotos que suba
  cada distribuidora.

**Prioridad del precio:** el que ella ya le puso a esa pieza → el del catálogo
global → el impreso en el ticket. Nunca se le pisa una decisión suya.

**Si el código no está en el catálogo** se muestra *Producto no encontrado*, con
dos salidas: buscarlo a mano en el catálogo, o darlo de alta —prellenado con la
descripción y el precio que traía el ticket—.

**Configuración.** Necesita un secret; sin él, todo lo demás funciona y la
recepción cae al modo de captura manual:

```bash
npx wrangler secret put ANTHROPIC_API_KEY
```

Límite: 30 lecturas por hora **por distribuidora** (no por IP: varias pueden
compartir la conexión de un local).

---

---

## Club de puntos

Cada distribuidora lleva su propio club. No hay una bolsa global de puntos: los
que una clienta juntó comprándole a Ana no valen nada con María, igual que la
tarjeta de una cafetería no sirve en la de enfrente.

**Ella lo configura** en `/dashboard/loyalty`:

- Enciende o apaga el club. Apagado no acumula nada — encenderlo un año después
  y encontrarse con saldos que nunca ofreció sería peor que no tenerlo.
- La tasa, dicha como se la explicaría a una clienta: *1 punto por cada $10*.
- Puntos de bienvenida, una sola vez, al registrarse.
- Sus recompensas: % de descuento, descuento en pesos, o un regalo.
- Sus condiciones, en texto libre.

**La clienta se registra** en `/{slug}/club` con nombre, apellido y teléfono.
Nada más. Ve su saldo, su nivel, lo que le falta para el siguiente y sus
cupones. Canjear le da un código (`NC-XXX-XXX`) que puede copiar o mandar por
WhatsApp de un toque.

### Cómo se sostiene

- **Sin contraseñas, a propósito.** Pedirle a alguien que invente y recuerde
  una contraseña para consultar sus puntos de una joyería es la forma más
  segura de que nadie use el club. La identidad es teléfono + nombre: para
  entrar a la cuenta de otra persona hacen falta las dos cosas. Del otro lado
  solo hay puntos y cupones de una tienda — ni pagos, ni domicilio, ni forma de
  gastar dinero de nadie. Si el club llega a guardar algo más delicado, esa
  puerta tiene que cambiar. La decisión vive documentada en `lib/member.ts`.
- **La cookie del club trae el `sellerId`.** Una sesión del club de Ana no abre
  el de María ni copiándola a mano.
- **El canje descuenta con `points >= costo` dentro del propio UPDATE.** Dos
  toques seguidos —o dos teléfonos— no emiten dos cupones con el saldo de uno.
- **El cupón se copia al canjear.** Si mañana ella baja el descuento de 10% a
  5%, el cupón que alguien ya tiene en la mano sigue valiendo el 10%.
- **El nivel se calcula sobre el acumulado histórico**, no sobre el saldo:
  canjear un cupón no debe degradar a nadie.
- **El cupón se quema al registrar la venta, no al generar el pedido.** Un
  pedido es una intención; quemarlo ahí dejaría sin cupón a quien nunca llegó a
  comprar.
- **El descuento se calcula siempre en el servidor**, sobre los precios que
  acaba de leer la base. Del navegador solo llega un código.
- **Cancelar un cupón devuelve los puntos.** Si ella ya no puede honrarlo,
  quien no debe perder es quien los juntó.

Las reglas puras (etiquetas, cálculo del descuento, niveles) viven en
`lib/loyalty-rules.ts` para poder usarse también en el navegador; todo lo que
toca la base está en `lib/loyalty.ts`, marcado `server-only`.

---

## Costos y ganancia

Una distribuidora NICE le compra a NICE con un descuento sobre el precio de
catálogo. Esa diferencia es su negocio entero, y hasta ahora el sistema solo
sabía la mitad: lo que cobraba.

Ella escribe **su descuento** una sola vez en Configuración (`30`, por ejemplo)
y de ahí sale el costo estimado de cada pieza: catálogo × (1 − descuento). Se
prellena al recibir mercancía y al dar de alta una pieza, y siempre se puede
corregir — el ticket manda sobre la fórmula.

Con eso aparecen tres cosas que antes no existían:

- **Cuánto vale su inventario**, en tres monedas a la vez: lo invertido, lo que
  vale a catálogo NICE y lo que se llevaría si lo vendiera todo a su precio.
- **La ganancia por pieza**, junto al precio en su lista de inventario.
- **La ganancia real de un periodo**, en Analytics y en su pantalla de inicio.

### Lo que no se hace, y por qué

- **Una pieza sin costo se dice, no se asume en cero.** Un cero significaría
  que le salió gratis e inflaría la ganancia; el nulo dice la verdad —no se
  sabe— y las pantallas reportan aparte cuántas faltan por costear.
- **El costo se copia al vender** (`sale_items.unit_cost_cents`). Si el mes que
  entra recibe la misma pieza más cara, la ganancia de la venta de hoy tiene
  que seguir calculándose con lo que le costó hoy.
- **El descuento nunca sale a la tienda pública.** Es información de su
  negocio, no de su vitrina.

---

## Ventas a abonos

Mucha clienta aparta y va pagando. Eso se modela como un estado de la venta y
no como una entidad aparte:

- Un apartado **sí descuenta el inventario**. La pieza ya se guardó para esa
  persona y nadie más se la puede llevar; lo que queda abierto es el cobro, no
  la mercancía.
- El **saldo se deriva** (total − abonado), nunca se guarda. Un acumulado que
  se actualiza a mano acaba desfasado del detalle justo el día que alguien
  reclama.
- **Cada abono queda escrito**, incluido el anticipo. El detalle siempre cuadra
  con la suma de sus renglones, sin un caso especial para "el primero no
  cuenta".
- **Los puntos llegan al liquidar**, no al apartar. Darlos por adelantado
  dejaría canjear una recompensa con dinero que todavía no entró — y quitarlos
  después sería peor que no haberlos dado. La bandera `points_awarded` impide
  que dos abonos casi simultáneos los otorguen dos veces.
- **Un apartado exige nombre y teléfono.** Sin eso no hay a quién cobrarle.
- **Cancelar devuelve las piezas al inventario** y deja el movimiento escrito.
  Los abonos ya recibidos NO se borran: son constancia de que ese dinero entró.
  Qué se hace con él lo acuerdan ella y su clienta, no este sistema.

Lo que se debe aparece en su pantalla de inicio y arriba de sus ventas, con los
que ya se pasaron de la fecha acordada, y hay un botón para recordarle por
WhatsApp con el saldo ya escrito.

---

## Descargar para Excel

Desde Analytics —y desde cada pantalla, con su propio botón— se descargan
ventas, abonos y saldos, inventario, clientes y pedidos.

Son archivos `.csv`, no `.xlsx`. Un xlsx es un ZIP con varios XML dentro, y
armarlo en un Worker significa cargar una librería de cientos de kilobytes para
producir un archivo que Excel abre exactamente igual que este. Cuando alguien
pida formatos, fórmulas o varias hojas, ese será el momento de pagar ese
precio.

Tres detalles que parecen menores y son la diferencia entre un archivo que se
abre bien de doble clic y uno que llega hecho un desastre (todos en `lib/csv.ts`):

- **Separador punto y coma.** Excel en español lo usa como separador de listas;
  con comas, todo el renglón aterriza en la columna A.
- **BOM al inicio.** Sin él, Excel en Windows lee el archivo como ANSI y
  "María Gutiérrez" se convierte en "MarÃ­a GutiÃ©rrez".
- **Números con coma decimal**, que es lo que Excel en español reconoce como
  número y no como texto.

Y una precaución que no es de formato: las celdas que empiezan con `=`, `+`,
`-` o `@` se prefijan con un apóstrofo. Excel las interpretaría como fórmula, y
un nombre de cliente escrito como `=cmd|...` es una inyección de fórmula de
manual. El apóstrofo no se ve en la celda.

El reporte de ventas sale **por partida**, un renglón por pieza vendida: es lo
que sirve para armar una tabla dinámica. Una fila por venta obligaría a abrir
cada una para saber qué llevaba.

---

## Apartado temporal

Dos clientas abren la misma tienda un sábado, las dos ven "queda 1", las dos
mandan su pedido y una se va a quedar sin nada. El inventario decía la verdad
en los dos momentos: lo que faltaba era que la primera en tomarla la retuviera
mientras decide.

Al poner una pieza en el carrito queda **apartada 15 minutos**, y al mandar el
pedido por WhatsApp ese apartado se estira a **24 horas** — del otro lado hay
una conversación de verdad y la distribuidora puede tardar en contestar.

Quien la apartó sigue viendo *Agregar al carrito*. Quien llega después ve
**Apartada**, no "Agotado": son dos cosas distintas para quien la quería, y
decirle que se agotó cuando volverá en diez minutos es una venta que se pierde
por escribir mal un mensaje.

### Las reglas de las que cuelga todo

- **En `app/dashboard/` no va un `loading.tsx`.** Hubo uno y dejaba el panel
  muerto en cualquier carga directa: el límite de Suspense que crea se servía
  pospuesto (`$~` en el HTML) y el cliente nunca lo resolvía, así que React
  hidrataba el menú pero no el contenido. La página se veía perfecta y ningún
  botón respondía. Navegando dentro del panel sí funcionaba —el contenido se
  pinta en el cliente—, por eso tardó tanto en salir. Si algún día se quiere un
  esqueleto de carga, hay que comprobar antes que el contenido siga hidratando
  al recargar.
- **El margen se calcula solo sobre lo costeado.** Dividir la ganancia entre el
  valor de todo el inventario mete en el divisor piezas que no aportan al
  numerador y devuelve un margen muy por debajo del real.
- **Una reserva no baja el stock.** El stock son las piezas que ella tiene en su
  casa. Lo que cambia es cuántas están disponibles *para alguien más*. Si bajara
  el stock, un carrito abandonado se vería en el panel como mercancía esfumada.
- **Siempre vence.** Un apartado eterno es una pieza perdida: nadie va a volver
  a ese carrito y nadie más la va a poder comprar.
- **Vence solo.** Las consultas filtran por `expires_at > ahora`, así que una
  reserva vencida deja de contar sin que nada tenga que ir a borrarla. La
  limpieza que sí ocurre es por higiene, no por corrección — y por eso esto no
  necesita un cron.
- **Tus propias reservas no te estorban.** Al calcular disponibilidad se
  excluyen las del visitante que pregunta; si no, su propio carrito le diría que
  la pieza que acaba de apartar está agotada.
- **El apartado se sostiene con presencia, no con una pestaña.** Se renueva
  mientras haya toques, teclas o scroll; tras diez minutos sin señales de vida
  se deja vencer. Renovar solo porque una pestaña sigue abierta sería lo peor de
  los dos mundos: la pieza retenida para siempre por alguien que se fue a dormir,
  y la clienta que sí la quiere sin verla nunca.
- **Un pedido nunca se degrada a carrito.** Si alguien ya mandó su pedido y
  vuelve a poner la misma pieza en el carrito, su apartado de un día no se
  encoge a quince minutos.

### Quién es "yo"

Una cookie opaca (`nsh_visitor`). No dice quién es la persona y no hace falta
que lo diga: solo tiene que distinguir "yo" de "alguien más". Quien borre su
cookie pierde sus propias reservas; no gana las de nadie. Ese es el peor caso y
es aceptable.

### Lo que ve la clienta

En su carrito y en el checkout: **"Te las apartamos por 14:32"**, en ámbar los
últimos tres minutos, y al llegar a cero un aviso con botón para volver a
apartarlas. Si alguien más alcanzó a llevarse una pieza mientras lo pensaba, el
carrito se ajusta solo y se lo dice con nombre — ajustarlo en silencio sería
peor.

**No hay notificaciones fuera de la página.** Ni push ni correo: el aviso vive
en la pantalla que tiene abierta. Mandarle un mensaje a alguien que cerró el
navegador necesita correo o WhatsApp Business API, y ninguno de los dos existe
todavía. Está anotado en los pendientes.

### Lo que ve la distribuidora

En su inventario, un contador morado por pieza: *2 apartadas*. No le baja el
stock — para ella el inventario son las piezas que tiene en su casa, y verlo
bajar porque alguien dejó un carrito abierto sería mentirle sobre su propia
mercancía.

### Cuándo se sueltan

- Al quitar la pieza del carrito, enseguida. Dejarla vencer bloquearía un cuarto
  de hora justo lo que otra clienta está buscando.
- Al registrar la venta del pedido: ahí el stock ya bajó de verdad y seguir
  reteniendo sería descontar dos veces.
- Al cancelar o entregar el pedido.
- Solas, al vencer.

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
  page.tsx                 portada (solo para distribuidoras)
  login/ register/         alta y acceso
  [seller]/                LA TIENDA PÚBLICA
    page.tsx               catálogo con búsqueda y filtros
    product/[code]/        detalle de la pieza
    cart/ checkout/        carrito y confirmación
    order/[number]/        folio + botón de WhatsApp
    club/                  CLUB: registro, tarjeta, canje
  dashboard/               PANEL DE LA DISTRIBUIDORA
    inventory/             lista, alta y edición
      receive/             RECEPCIÓN: captura y revisión del borrador
    loyalty/               CLUB: reglas, recompensas, cupones
    sales/[id]/            detalle de una venta y sus abonos
    orders/ sales/ customers/ analytics/ qr/ settings/
    actions.ts             server actions (todas pasan por requireSeller)
    reception-actions.ts   acciones de la recepción
  admin/                   panel de plataforma: el UNICO lugar donde se ven
                           todas las tiendas juntas
  api/
    auth/                  login, registro, cierre de sesión
    stores/[slug]/orders/  creación de pedidos (público, con límite por IP)
    stores/[slug]/hold/    apartado temporal del carrito (público)
    dashboard/receptions/  foto del ticket → borrador (privado)
    dashboard/catalog/lookup/  qué sabe NICE de un código (privado)
    dashboard/export/      descargas para Excel (privado)

lib/
  session.ts    de dónde sale el sellerId          [server-only]
  seller.ts     lecturas del panel, acotadas       [server-only]
  mutations.ts  escrituras del panel, acotadas     [server-only]
  store.ts      lecturas públicas de una tienda    [server-only]
  orders.ts     folios y creación de pedidos       [server-only]
  reservations.ts  apartado temporal de piezas     [server-only]
  receptions.ts borradores de recepción            [server-only]
  ocr.ts        lectura del ticket con visión      [server-only]
  nice-catalog.ts  resuelve un Id Nice contra      [server-only]
                   niceonline.com (foto, nombre,
                   precio) verificando el sku
  loyalty.ts    puntos, recompensas y canjes        [server-only]
  member.ts     la sesión de una clienta del club   [server-only]
  admin.ts      consultas de plataforma            [server-only]
  whatsapp.ts   el mensaje del pedido              (puro)
  inventory.ts  estados derivados del stock        (puro)
  format.ts     dinero, fechas, slugs              (puro)
  phone.ts      normalización a formato E.164      (puro)
```

---

---

## Marca

**DSD Seller Hub** es el software. **NICE** es la marca de joyería que venden
las distribuidoras que hoy lo usan, y no nos pertenece.

Los dos nombres viven en lugares distintos a propósito: el logotipo, el título
del sitio y el pie dicen DSD; "NICE" solo aparece donde de verdad corresponde
—el código de la pieza, el catálogo, la tienda de cada distribuidora, el ticket
que fotografían—. Si mañana estas mismas distribuidoras venden otra marca, o si
lo usa alguien de otro giro, lo único que cambia son esos textos de producto.

Los términos lo dicen explícitamente: no hay relación comercial ni
representación de NICE. Eso también está en los pendientes, como conversación
por tener.

---

## Recuperar contraseña

No hay correo saliente todavía, así que no puede haber un "olvidé mi
contraseña" que se resuelva solo. Lo que sí hay:

En `/admin/sellers`, junto a cada distribuidora, un botón **Contraseña** genera
un enlace de un solo uso y lo ofrece para copiar o **mandar por WhatsApp** con
el mensaje ya escrito. Ella lo abre, escribe su contraseña nueva y entra de
inmediato — la sesión se abre sola, sin pedirle que vuelva a teclear lo que
acaba de elegir.

- Dura **12 horas** y sirve **una sola vez**.
- Del token se guarda solo su huella SHA-256. Quien leyera esa tabla no obtiene
  ningún enlace utilizable — el mismo criterio que con las contraseñas.
- Generar uno nuevo invalida el anterior.
- La página no revela el correo de la cuenta: un enlace vencido que alguien
  reenvió por error no tiene por qué filtrar nada.

Cuando exista correo saliente, este mismo token se manda solo y el flujo se
vuelve autoservicio sin cambiar nada de la lógica. `scripts/set-password.mjs`
sigue ahí como último recurso si se pierde también la cuenta de admin.

---

## Respaldos

```bash
npm run backup
```

Exporta la base de producción completa a `backups/` — probado, no supuesto:
salieron 42 KB de SQL con todo el esquema y los datos. Esa carpeta está en
`.gitignore` porque trae nombres y teléfonos de clientas reales.

Cloudflare además guarda 30 días de recuperación puntual sobre D1. Vale la pena
hacer un simulacro de restauración antes de abrir: un respaldo que nunca se ha
restaurado no es un respaldo.

## Antes de abrirlo al público

Ordenados por lo que más estorba:

1. **Correo saliente.** Sin él, recuperar contraseña no puede ser autoservicio
   (hoy lo genera el admin desde `/admin/sellers`) y no hay verificación de
   cuenta ni avisos de ningún tipo. Resend o MailChannels, unas dos horas.
2. **Llenar `lib/legal.ts`.** El aviso de privacidad y los términos ya están
   publicados en `/privacidad` y `/terminos`, pero les falta el correo de
   contacto del responsable. Mientras esté vacío las páginas lo dicen en voz
   alta en vez de aparentar que cumplen. Y conviene que un abogado los lea.
3. **Dominio propio.** Hoy es `nice-seller-hub.sesar21macias.workers.dev`. Las
   distribuidoras van a compartir ese enlace en sus redes; un dominio propio
   cambia la credibilidad. Es configuración de Cloudflare, no código.
4. **Vigilar el gasto de la lectura de tickets.** Hay dos topes por
   distribuidora —30 por hora y 200 al mes— pero nadie mira el consumo real.
   Conviene revisar la factura de Anthropic el primer mes con gente de verdad.
5. **Subir fotos propias.** Para piezas que no estén en el catálogo de NICE hoy
   hay que pegar una URL. Falta el adaptador a R2.
6. **Correo.** No hay verificación de cuenta ni avisos de ningún tipo.
7. **Autorización de NICE.** La parte del catálogo lee páginas públicas de su
   tienda. Funciona, pero no es un acuerdo. Conviene hablarlo antes de que esto
   sea el sustento de alguien.
8. **Nunca se probó con carga real.** Está diseñado para escalar; eso no es lo
   mismo que haberlo comprobado.
9. **Enterarse cuando algo truene.** Los logs del Worker están encendidos
   (`observability`), pero nadie los mira. Hoy te enteras porque una
   distribuidora te habla.

## Lo que todavía no está

Fase 1 quedó completa. Pendientes deliberados:

- **Copiar las imágenes a R2.** Hoy se enlazan desde el CDN de NICE. Copiarlas
  dejaría de depender de sus URLs y de su ancho de banda — pero requiere su
  autorización.
- **Subida de fotos propias.** Para piezas que no estén en el catálogo de NICE,
  hoy se pega la URL. Falta el adaptador a R2; el resto ya está listo.
- **Cuentas de cliente completas.** Con el club ya hay identidad: la clienta
  entra con nombre y teléfono, y sus pedidos quedan ligados a su cuenta. Lo que
  falta es historial de pedidos desde su lado y poder editar sus datos.
- **Historial de costos.** Hoy cada pieza guarda un costo; si el mismo código se
  recibe dos veces a precios distintos, el segundo pisa al primero para lo que
  quede en existencia. Las ventas ya hechas conservan el suyo. Un costo promedio
  o por capa (PEPS) sería lo correcto cuando el volumen lo justifique.
- **Avisar fuera de la página.** El aviso de que se acaba un apartado vive en la
  pantalla que la clienta tiene abierta; si cerró el navegador, no se entera.
  Mandarle un mensaje necesita correo o WhatsApp Business API.
- **Recordatorios automáticos de cobranza.** Hoy el recordatorio de un abono se
  manda a mano desde la venta. Mandarlo solo requiere correo o WhatsApp Business
  API, que todavía no hay.
- **Caducidad de puntos y de cupones.** Hoy ni los puntos ni los cupones
  vencen. Es lo correcto para empezar, pero cuando el club crezca conviene
  decidirlo antes de que alguien acumule tres años de saldo.
- **Pagos en línea.** El modelo separa pedido de venta justo para que Stripe o
  Mercado Pago entren después sin rehacer nada.
