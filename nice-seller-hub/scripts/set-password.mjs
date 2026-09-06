import { webcrypto as crypto } from "node:crypto";
import { spawnSync } from "node:child_process";

/**
 * Cambia la contraseña de una cuenta.
 *
 * La contraseña se teclea aquí, en la terminal de quien lo corre: no se pasa
 * como argumento —quedaría en el historial del shell y en la lista de procesos—
 * ni viaja por ningún otro lado. Solo sale de aquí el hash.
 *
 * Existe además porque todavía no hay "olvidé mi contraseña": mientras tanto,
 * esta es la forma de devolverle el acceso a alguien.
 *
 *   node scripts/set-password.mjs                 (base local)
 *   node scripts/set-password.mjs --remote        (producción)
 */

// Debe coincidir con lib/auth.ts. Cloudflare no admite más de 100 000.
const PBKDF2_ITERATIONS = 100_000;
const DB_NAME = "nice-seller-hub";

const remote = process.argv.includes("--remote");
const enc = new TextEncoder();

const hex = (buf) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

function randomHex(bytes = 16) {
  return hex(crypto.getRandomValues(new Uint8Array(bytes)));
}

async function hashPassword(password, salt) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: enc.encode(salt), iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    key,
    256
  );
  return hex(bits);
}

/**
 * Lee una línea de la terminal.
 *
 * Se hace con stdin en modo crudo, carácter por carácter, en vez de con
 * `readline`: es la única forma de no dibujar la contraseña en pantalla sin
 * pelearse con el eco de readline —que fue justo lo que dejó el prompt
 * atascado sin aceptar teclas—.
 *
 * `mask` decide si se muestra lo tecleado. Un pegado llega como un solo trozo
 * de varios caracteres, por eso se recorre.
 */
function prompt(question, { mask = false } = {}) {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;

    if (!stdin.isTTY) {
      reject(new Error("Este script necesita una terminal interactiva."));
      return;
    }

    process.stdout.write(question);

    let buffer = "";
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    const done = (value) => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener("data", onData);
      process.stdout.write("\n");
      resolve(value);
    };

    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") {
          done(buffer);
          return;
        }
        if (ch === "\u0003") {
          // Ctrl+C
          stdin.setRawMode(false);
          process.stdout.write("\n");
          process.exit(130);
        }
        if (ch === "\u007f" || ch === "\b") {
          if (buffer.length > 0) {
            buffer = buffer.slice(0, -1);
            if (!mask) process.stdout.write("\b \b");
          }
          continue;
        }
        // Se ignoran las teclas de control (flechas, etc.).
        if (ch < " ") continue;

        buffer += ch;
        process.stdout.write(mask ? "•" : ch);
      }
    };

    stdin.on("data", onData);
  });
}

console.log(
  `\nCambiar contraseña — base ${remote ? "DE PRODUCCIÓN" : "local"}\n`
);

const email = (await prompt("Correo de la cuenta: ")).trim().toLowerCase();
if (!email.includes("@")) {
  console.error("Ese correo no se ve válido. No se cambió nada.");
  process.exit(1);
}

const password = await prompt("Contraseña nueva: ", { mask: true });
if (password.length < 12) {
  console.error("Usa al menos 12 caracteres. No se cambió nada.");
  process.exit(1);
}

const confirmation = await prompt("Repítela: ", { mask: true });
if (password !== confirmation) {
  console.error("No coinciden. No se cambió nada.");
  process.exit(1);
}

const salt = randomHex(16);
const hash = await hashPassword(password, salt);

// El correo va escapado para SQL; la contraseña nunca entra en la sentencia.
const sql =
  `UPDATE users SET password_hash = '${hash}', password_salt = '${salt}', ` +
  `password_iterations = ${PBKDF2_ITERATIONS} ` +
  `WHERE email = '${email.replace(/'/g, "''")}';`;

console.log("\nAplicando…\n");

const res = spawnSync(
  "npx",
  ["wrangler", "d1", "execute", DB_NAME, remote ? "--remote" : "--local", "--command", sql],
  { stdio: "inherit", shell: true }
);

if (res.status !== 0) {
  console.error("\nNo se pudo aplicar el cambio.");
  process.exit(1);
}

console.log(`\nListo: contraseña de ${email} actualizada.`);
console.log("Si arriba dice 'rows_written: 0', ese correo no existe en la base.");
