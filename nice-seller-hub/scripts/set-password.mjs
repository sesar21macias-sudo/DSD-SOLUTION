import { webcrypto as crypto } from "node:crypto";
import { createInterface } from "node:readline";
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

function ask(question, hidden = false) {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });

  return new Promise((resolve) => {
    if (!hidden) {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
      return;
    }

    // Sin eco: la contraseña no se dibuja en pantalla ni queda en el scrollback.
    process.stdout.write(question);
    const onData = (char) => {
      const s = String(char);
      if (s === "\n" || s === "\r" || s === "") process.stdin.pause();
      else process.stdout.write("");
    };
    process.stdin.on("data", onData);
    rl.output.write = () => {};

    rl.question("", (answer) => {
      process.stdin.removeListener("data", onData);
      rl.close();
      process.stdout.write("\n");
      resolve(answer.trim());
    });
  });
}

const email = (await ask("Correo de la cuenta: ")).toLowerCase();
if (!email.includes("@")) {
  console.error("Ese correo no se ve válido.");
  process.exit(1);
}

const password = await ask("Contraseña nueva (no se muestra): ", true);
if (password.length < 12) {
  console.error("Usa al menos 12 caracteres. Esta cuenta administra toda la plataforma.");
  process.exit(1);
}

const confirmation = await ask("Repítela: ", true);
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

const args = ["wrangler", "d1", "execute", DB_NAME, remote ? "--remote" : "--local", "--command", sql];
const res = spawnSync("npx", args, { stdio: "inherit", shell: true });

if (res.status !== 0) {
  console.error("\nNo se pudo aplicar el cambio.");
  process.exit(1);
}

console.log(`\nListo. Contraseña de ${email} actualizada en la base ${remote ? "de producción" : "local"}.`);
console.log("Si no ves 'rows_written: 1' arriba, ese correo no existe en la base.");
