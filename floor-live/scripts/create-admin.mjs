// Crea una cuenta de ADMINISTRADOR directo en la base, aunque ya existan otras.
// Sirve para entrar siempre, pase lo que pase con /inicio.
//
//   node scripts/create-admin.mjs            → base en línea (floor-live.sesar21macias.workers.dev)
//   node scripts/create-admin.mjs --local    → base local (npm run dev)
//
// La contraseña se escribe en la terminal sin mostrarse y nunca sale de esta
// computadora: aquí se cifra (PBKDF2, igual que lib/auth.ts) y solo viaja el hash.
// Si las respuestas llegan por un pipe, se leen una por línea (nombre, usuario,
// contraseña, contraseña otra vez).
import { webcrypto as crypto } from "node:crypto";
import { execSync } from "node:child_process";
import readline from "node:readline";

const LOCAL = process.argv.includes("--local");
const ITER = 100_000;
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
const NEWLINE = String.fromCharCode(10);
const enc = new TextEncoder();
const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");

const piped = process.stdin.isTTY
  ? null
  : await new Promise((res) => {
      let buf = "";
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (c) => (buf += c));
      process.stdin.on("end", () => res(buf.replaceAll(String.fromCharCode(13), "").split(NEWLINE)));
    });

function ask(question) {
  if (piped) {
    console.log(question);
    return Promise.resolve((piped.shift() ?? "").trim());
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => rl.question(question, (a) => (rl.close(), res(a.trim()))));
}

/** Lee una línea sin mostrar lo que se escribe (asteriscos en su lugar). */
function askHidden(question) {
  if (piped) {
    console.log(question + "********");
    return Promise.resolve(piped.shift() ?? "");
  }
  return new Promise((res) => {
    process.stdout.write(question);
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let value = "";
    const onData = (chunk) => {
      for (const c of chunk) {
        const code = c.charCodeAt(0);
        if (code === 13 || code === 10) {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.removeListener("data", onData);
          console.log("");
          return res(value);
        }
        if (code === 3) process.exit(1); // Ctrl+C
        if (code === 127 || code === 8) {
          if (value.length) {
            value = value.slice(0, -1);
            process.stdout.write(String.fromCharCode(8) + " " + String.fromCharCode(8));
          }
          continue;
        }
        value += c;
        process.stdout.write("*");
      }
    };
    stdin.on("data", onData);
  });
}

async function hash(pw, salt) {
  const key = await crypto.subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveBits"]);
  return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", salt: enc.encode(salt), iterations: ITER, hash: "SHA-256" }, key, 256));
}

function d1(sql) {
  const where = LOCAL ? "--local" : "--remote";
  try {
    return execSync(`npx wrangler d1 execute floor-live ${where} --json --command "${sql}"`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (err) {
    const text = String(err.stdout || err.stderr || err.message);
    console.error("");
    console.error("No se pudo hablar con la base de datos:");
    console.error(
      /not authenticated|wrangler login/i.test(text)
        ? "Wrangler no tiene sesión. Corre `npx wrangler login` con la cuenta sesar21macias y vuelve a intentar."
        : text.trim().slice(0, 400)
    );
    process.exit(1);
  }
}

console.log("");
console.log(`Crear administrador en la base ${LOCAL ? "LOCAL" : "EN LÍNEA"} de Floor Live`);
console.log("");

const name = await ask("Tu nombre (como lo verá el equipo): ");
if (!name || /["\\]/.test(name) || name.length > 60) {
  console.error("Escribe un nombre de hasta 60 caracteres, sin comillas dobles.");
  process.exit(1);
}
const username = (await ask("Usuario para entrar (letras, números o _): ")).toLowerCase();
if (!USERNAME_RE.test(username)) {
  console.error("El usuario debe tener de 3 a 20 caracteres: solo letras, números y guion bajo.");
  process.exit(1);
}
const pw = await askHidden("Contraseña (mínimo 8): ");
if (pw.length < 8 || pw.length > 200) {
  console.error("La contraseña necesita al menos 8 caracteres.");
  process.exit(1);
}
const pw2 = await askHidden("Repite la contraseña: ");
if (pw !== pw2) {
  console.error("Las contraseñas no coinciden. No se creó nada.");
  process.exit(1);
}

const taken = JSON.parse(d1(`SELECT COUNT(*) AS n FROM users WHERE username = '${username}'`))[0].results[0].n;
if (taken > 0) {
  console.error(`El usuario "${username}" ya existe. Escoge otro.`);
  process.exit(1);
}

const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
const h = await hash(pw, salt);
const sqlName = name.replace(/'/g, "''");
d1(
  `INSERT INTO users (username, name, role, password_hash, password_salt, iterations) ` +
    `VALUES ('${username}', '${sqlName}', 'admin', '${h}', '${salt}', ${ITER})`
);

console.log("");
console.log(`Listo. "${username}" ya es administrador.`);
console.log(LOCAL ? "Entra en http://localhost:3600" : "Entra en https://floor-live.sesar21macias.workers.dev");
