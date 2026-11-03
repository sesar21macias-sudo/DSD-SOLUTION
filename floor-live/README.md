# Beaufort Floor Live

Pantallas de planta (TV) con métricas en vivo, anuncios y fotos. Una pantalla general
para toda la planta y una por equipo; cada líder entra con su usuario y ve su equipo.

## Cómo funciona

1. **Datos** — el gerente sube el Excel semanal de trabajos cerrados (el mismo de Power BI).
   Se lee en el navegador, se valida otra vez en el servidor y se guarda por (año, trabajo):
   volver a subirlo corrige, no duplica. Los equipos nuevos se dan de alta solos.
2. **Cálculos** (siempre con sumas, nunca promediando porcentajes):
   - Calidad (FPY) = piezas que pasaron ÷ piezas inspeccionadas.
   - Eficiencia = horas estimadas ÷ horas reales (más de 100% = más rápido que el estándar).
   - Semáforo: verde en meta, ámbar a pocos puntos, rojo abajo. Siempre con palabra e ícono.
3. **Resumen en lenguaje sencillo** — al subir el Excel, Claude escribe una o dos frases por
   equipo y para la planta (inglés y español). Sin `ANTHROPIC_API_KEY` se usan reglas fijas.
4. **Teles** — cada tele abre `/tv`, muestra un código de 6 letras y el admin lo escribe en
   **Pantallas** eligiendo qué muestra (planta o un equipo), idioma y segundos por lámina.
   La tele guarda un secreto en una cookie; desconectarla en el panel la revoca.
5. **Anuncios y fotos** — de planta (admin) o de un equipo (admin o su líder). Claude puede
   pulir un anuncio y traducirlo.

Láminas de la tele de planta: seguridad (días sin accidente), calidad y eficiencia de la semana,
rankings de equipos, últimas semanas, defectos del mes, intercaladas con anuncios y fotos.
Tele de equipo: su semana, sus defectos, sus trabajos cerrados, su tendencia, el ranking con su
equipo resaltado y seguridad. Flechas ← → cambian de lámina.

## Desarrollo local

```bash
npm install
npm run db:local          # crea las tablas en la base local
npm run dev               # http://localhost:3600
```

`.dev.vars` lleva `SETUP_CODE` (clave para crear el primer admin en `/inicio`) y, opcional,
`ANTHROPIC_API_KEY`.

## Publicar en Cloudflare (cuenta sesar21macias)

```bash
npx wrangler d1 create floor-live          # copia el database_id a wrangler.jsonc
npx wrangler r2 bucket create floor-live-media
npm run db:remote
npx wrangler secret put SETUP_CODE
npx wrangler secret put ANTHROPIC_API_KEY  # opcional
npm run deploy
```

Después entra a `/inicio` con la clave para crear el administrador (se apaga sola cuando ya
existe una cuenta). `npm run create-admin` crea otro admin desde la terminal si hiciera falta.

## Seguridad

- Contraseñas con PBKDF2-SHA256 (100k vueltas) y sal por usuario; sesión en cookie firmada
  (HMAC), `HttpOnly`, `SameSite=Lax`, `Secure` en https.
- Freno de intentos: 8 fallos en 15 min por usuario y por IP (login, clave de instalación y Claude).
- Permisos en cada API: el líder solo toca su equipo; Datos, Pantallas y Equipos son solo admin.
- Cambios desde otro origen se rechazan (revisión de `Origin`), además de `SameSite`.
- CSP estricta, `X-Frame-Options: DENY`, `nosniff`, HSTS en producción.
- Fotos: el tipo se decide por los bytes del archivo (JPG/PNG/WebP), se sirven solo con sesión
  o a una tele autorizada, con `sandbox` y `nosniff`. No hay bucket público.
- El Excel se lee sin librerías externas (el paquete `xlsx` de npm tiene vulnerabilidades sin parche).
- SQL siempre con parámetros. Todo texto se pinta con React (escapado), nunca como HTML.
