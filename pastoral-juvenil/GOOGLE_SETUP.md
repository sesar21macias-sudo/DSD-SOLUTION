# Conexión con Google (Calendar + Drive + Docs/Sheets/Slides)

Guía única para dejar el sitio conectado a la cuenta admin (sesar21macias@gmail.com).
Solo se hace una vez.

## Paso 1 — Proyecto en Google Cloud

1. Entra a https://console.cloud.google.com con tu cuenta.
2. Arriba a la izquierda: selector de proyecto → "Proyecto nuevo".
3. Nombre: `pastoral-juvenil` → Crear → selecciónalo.

## Paso 2 — Habilitar las APIs

En el menú: **APIs y servicios → Biblioteca**. Busca y habilita (botón "Habilitar")
cada una de estas cinco:

- Google Calendar API
- Google Drive API
- Google Docs API
- Google Sheets API
- Google Slides API

## Paso 3 — Pantalla de consentimiento OAuth

1. **APIs y servicios → Pantalla de consentimiento de OAuth**.
2. Tipo de usuario: **Externo** → Crear.
3. Nombre de la app: `Pastoral Juvenil NSR`. Correo de asistencia: el tuyo.
4. Guarda todo con los valores por defecto (no necesitas logo ni dominios).
5. En "Usuarios de prueba" agrega tu propio correo.
6. Al terminar, en la misma pantalla: botón **"Publicar aplicación"** → confirmar.
   - Importante: si se queda en "Prueba", Google caduca el permiso cada 7 días.
   - No hace falta pasar la "verificación" de Google: la app es solo para tu cuenta.

## Paso 4 — Crear las credenciales

1. **APIs y servicios → Credenciales → + Crear credenciales → ID de cliente de OAuth**.
2. Tipo de aplicación: **App de escritorio**. Nombre: `pastoral-juvenil-cli`.
3. Copia el **ID de cliente** y el **Secreto de cliente**.

## Paso 5 — Autorizar y obtener el refresh token

En la terminal, dentro de la carpeta del proyecto:

```
node scripts/get-refresh-token.mjs <CLIENT_ID> <CLIENT_SECRET>
```

- Abre el enlace que imprime, entra con tu cuenta y acepta los permisos.
- Si aparece "Google no ha verificado esta app": **Avanzado → Ir a Pastoral Juvenil NSR (no seguro)** → Continuar. (Es tu propia app; es normal.)
- El `GOOGLE_REFRESH_TOKEN` aparece en la terminal.

## Paso 6 — Guardar los secretos en Cloudflare

```
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put GOOGLE_REFRESH_TOKEN
npx wrangler secret put ANTHROPIC_API_KEY
```

(cada comando pide pegar el valor; la API key de Anthropic sale de
https://console.anthropic.com → API Keys)

## Paso 7 — Avisar a Claude Code

Con los 4 secretos guardados, pide en la sesión: "ya están los secretos,
conecta Google y el agente". Ahí se construye:

- Calendario secundario "Pastoral Juvenil 2026-2027" en tu cuenta
- Botón "Vincular a mi calendario" para que el equipo lo siga en su celular
- CRUD real de eventos (protegido por el login admin)
- Agente Claude con herramientas de Docs/Sheets/Slides que guarda en la
  subcarpeta de Drive del ministerio activo (IDs ya mapeados en
  `lib/ministryFolders.ts`)
