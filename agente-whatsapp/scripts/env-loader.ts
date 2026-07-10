// Solo side effects: puebla process.env desde .env.local antes de que
// cualquier otro modulo lea sus variables. Los `import` de ES modules se
// hoistean al top del archivo que los usa, asi que este loader NUNCA debe
// exportar nada; debe ser el PRIMER import de start-bot.ts para garantizar
// que corre antes de que se evaluen los top-level de openrouter.ts, etc.

import path from "node:path";
import fs from "node:fs";

const envPath = path.resolve(process.cwd(), ".env.local");

if (fs.existsSync(envPath)) {
  const text = fs.readFileSync(envPath, "utf-8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}
