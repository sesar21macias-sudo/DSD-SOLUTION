/**
 * Script de autorización única con Google (OAuth 2.0, app de escritorio).
 *
 * Uso:
 *   node scripts/get-refresh-token.mjs <CLIENT_ID> <CLIENT_SECRET>
 *
 * Abre el enlace que imprime, autoriza con la cuenta admin del ministerio,
 * y el script imprime el GOOGLE_REFRESH_TOKEN para guardarlo en Cloudflare.
 */
import http from "node:http";
import crypto from "node:crypto";

const [clientId, clientSecret] = process.argv.slice(2);
if (!clientId || !clientSecret) {
  console.error("Uso: node scripts/get-refresh-token.mjs <CLIENT_ID> <CLIENT_SECRET>");
  process.exit(1);
}

const PORT = 8765;
const REDIRECT_URI = `http://127.0.0.1:${PORT}/callback`;

const SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/presentations",
].join(" ");

const state = crypto.randomBytes(16).toString("hex");

const authUrl =
  "https://accounts.google.com/o/oauth2/v2/auth?" +
  new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  }).toString();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT_URI);
  if (url.pathname !== "/callback") {
    res.writeHead(404).end();
    return;
  }

  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");

  if (!code || returnedState !== state) {
    res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
    res.end("<h2>Error: solicitud invalida. Cierra esta pestana e intenta de nuevo.</h2>");
    return;
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });
    const tokens = await tokenRes.json();

    if (!tokens.refresh_token) {
      throw new Error("Google no devolvio refresh_token: " + JSON.stringify(tokens));
    }

    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(
      "<h2>Listo. Ya puedes cerrar esta pestana y volver a la terminal.</h2>",
    );

    console.log("\n================= EXITO =================");
    console.log("GOOGLE_REFRESH_TOKEN=" + tokens.refresh_token);
    console.log("=========================================");
    console.log("\nGuardalo como secreto en Cloudflare con:");
    console.log("  npx wrangler secret put GOOGLE_REFRESH_TOKEN");
    console.log("(y tambien GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET)\n");
  } catch (err) {
    res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
    res.end("<h2>Error al intercambiar el codigo. Revisa la terminal.</h2>");
    console.error(err);
  } finally {
    server.close();
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("\n1. Abre este enlace en tu navegador:");
  console.log("\n" + authUrl + "\n");
  console.log("2. Entra con la cuenta de Google que sera dueña del calendario y el Drive.");
  console.log("3. Acepta los permisos (si sale 'app no verificada': Avanzado > Continuar).");
  console.log("4. Vuelve aqui: el refresh token aparecera en esta terminal.\n");
});
