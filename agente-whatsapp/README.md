# Agente WhatsApp

Bot de WhatsApp local (Baileys, no oficial) con dashboard de administración: lista de conversaciones, historial en vivo, toggle IA/Humano por chat, envío manual y borrado de conversaciones.

## Requisitos

- Node.js **20+** (recomendado 22 — ver nota abajo si tu Node global es más nuevo).
- Una API key de [OpenRouter](https://openrouter.ai/).

### Nota sobre Node en Windows

Este equipo tiene Node 24 global, y `better-sqlite3` (compilación nativa) todavía no publica binarios precompilados para Node 24 en Windows — instalarlo pedía Visual Studio Build Tools. En vez de eso, el proyecto trae una copia portátil de Node 22 en `.tools/node22/` (gitignored) que ya tiene binarios precompilados disponibles. Para correr cualquier comando de este proyecto, antepón esa carpeta al PATH:

```bash
PATH="$(pwd)/.tools/node22:$PATH" npm run dev
```

O usa directamente `./.tools/node22/npm.cmd <comando>`. Si en tu máquina el Node global ya es 22 LTS, puedes ignorar esto y usar `npm` normal.

## Configuración

1. Copia `.env.example` a `.env.local` y pon tu `OPENROUTER_API_KEY`.
2. `OPENROUTER_MODEL` recomendado: `openai/gpt-4o-mini`. Los modelos `:free` de OpenRouter tienen límite de 50 requests/día y van a fallar con error 429 en producción real.
3. Personaliza `src/lib/system-prompt.ts` con el prompt de tu negocio.

## Correr en desarrollo

Dos procesos en paralelo (o uno solo con `start:all`):

```bash
npm run start:bot   # levanta Baileys
npm run dev          # levanta el dashboard en localhost:3000
```

Abre `http://localhost:3000`: si no hay sesión guardada, vas a ver el QR ahí mismo (también se imprime en ASCII en la terminal del bot como respaldo). Escanea desde tu teléfono: WhatsApp → Dispositivos vinculados → Vincular un dispositivo.

La sesión se guarda en `./auth/`. Mientras esa sesión siga viva en WhatsApp, no vuelve a pedir QR en reinicios del proceso bot.

## Arquitectura

- El bot (`scripts/start-bot.ts`) y el dashboard (Next.js) corren en **procesos separados** y no comparten memoria — se comunican a través de SQLite (`data/messages.db`):
  - `connection_state`: fila única con el estado de la conexión y el QR actual.
  - `outbox`: cola de mensajes que el dashboard encola cuando estás en Modo Humano; el bot la revisa cada 2s y los envía por Baileys.
- El dashboard hace **polling cada 2s** (no WebSockets, ver "Mejoras pendientes").

## Seguridad — bloqueante para producción

El dashboard **no tiene autenticación**. Cualquiera con la URL puede leer todas tus conversaciones de WhatsApp y mandar mensajes haciéndose pasar por ti. Si vas a desplegar esto a internet, pon basic auth a nivel de proxy (Nginx/Caddy) o Cloudflare Access **antes** de exponerlo.

## Deploy (EasyPanel / Railway / Nixpacks)

- `Procfile` y `nixpacks.toml` ya están configurados (`npm run start:all` corre bot + dashboard juntos con `concurrently`).
- `.nvmrc` fuerza Node 22 (Nixpacks trae Node 18 por defecto, insuficiente para Baileys/Next 16/Tailwind 4).
- **Volúmenes persistentes obligatorios**: `/app/data` y `/app/auth`. Sin esto, cada redeploy borra las conversaciones guardadas y obliga a re-escanear el QR.

## Troubleshooting

- **Code 405** al conectar: versión de Baileys desactualizada — ya se resuelve solo con `fetchLatestBaileysVersion()` en `client.ts`.
- **Code 440 en loop**: el fingerprint del browser no coincide — ya se usa `Browsers.macOS('Desktop')` fijo, no lo cambies. Si igual pasa, borra en tu teléfono cualquier dispositivo vinculado viejo de pruebas anteriores en Configuración → Dispositivos vinculados.
- **Code 515**: es normal, es la señal de pairing exitoso, el bot reconecta solo.
- **Error 429 del LLM**: estás en un modelo `:free` de OpenRouter que llegó a su límite diario. Cambia `OPENROUTER_MODEL` a `openai/gpt-4o-mini`.
- **`OPENROUTER_API_KEY` undefined en el bot**: revisa que `.env.local` exista y que `scripts/env-loader.ts` sea el primer import de `start-bot.ts` (no lo muevas).

## Mejoras pendientes (fuera de scope v1)

- Soporte de imágenes salientes (enviar fotos de productos).
- Function calling real con `tools` de OpenRouter (extracción estructurada, scoring de leads, etc.).
- Auto-toggle a Modo Humano cuando el bot detecta una frase específica (regex en `handler.ts`).
- WebSocket en vez de polling.
- Autenticación básica en el dashboard (middleware de Next.js).
