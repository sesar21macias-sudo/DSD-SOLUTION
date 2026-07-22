"use client";

import { FormEvent, Suspense, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, type Variants } from "motion/react";
import { LockSimple, SignOut, User } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/Button";
import { FlameIcon } from "@/components/ui/FlameIcon";
import styles from "./LoginForm.module.css";

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] } },
};

function LoginFormInner({ initialAdmin }: { initialAdmin: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [admin, setAdmin] = useState(initialAdmin);
  const [usuario, setUsuario] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario: usuario.trim(), contrasena }),
      });
      const data: { ok: boolean; error?: string } = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Usuario o contraseña incorrectos.");
        return;
      }
      setAdmin(true);
      router.refresh();
      const from = searchParams.get("from");
      if (from && from.startsWith("/")) {
        router.push(from);
      }
    } catch {
      setError("No se pudo conectar. Intenta de nuevo.");
    } finally {
      setSending(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setAdmin(false);
    router.refresh();
  }

  return (
    <motion.div className={styles.card} variants={container} initial="hidden" animate="show">
      <motion.div variants={item} className={styles.crest}>
        <Image src="/logo.png" alt="Escudo de la Pastoral Juvenil NSR" width={72} height={72} priority />
      </motion.div>

      <motion.span variants={item} className={styles.eyebrow}>
        <FlameIcon size={13} />
        Acceso de administrador
      </motion.span>

      {admin ? (
        <>
          <motion.h1 variants={item} className={styles.title}>
            Sesión activa
          </motion.h1>
          <motion.p variants={item} className={styles.subtitle}>
            Ya iniciaste sesión como administrador. Puedes agregar y editar eventos del
            calendario desde el dashboard de cualquier ministerio.
          </motion.p>
          <motion.div variants={item} className={styles.actions}>
            <Button type="button" onClick={() => router.push("/ministerios")}>
              Ir a los ministerios
            </Button>
            <Button type="button" variant="secondary" onClick={handleLogout}>
              <SignOut size={16} style={{ display: "inline", verticalAlign: -3, marginRight: 6 }} />
              Cerrar sesión
            </Button>
          </motion.div>
        </>
      ) : (
        <>
          <motion.h1 variants={item} className={styles.title}>
            Entrar como admin
          </motion.h1>
          <motion.p variants={item} className={styles.subtitle}>
            Solo el equipo de coordinación necesita entrar aquí, para administrar el
            calendario. Todo lo demás es libre para cualquier ministerio.
          </motion.p>

          <motion.form variants={item} className={styles.form} onSubmit={handleSubmit}>
            <label className={styles.field}>
              <span className={styles.label}>Tu nombre</span>
              <div className={styles.inputWrap}>
                <User size={16} className={styles.inputIcon} />
                <input
                  className={styles.input}
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  autoComplete="off"
                  placeholder="Ingresa tu nombre"
                  required
                />
              </div>
            </label>

            <label className={styles.field}>
              <span className={styles.label}>PIN de acceso</span>
              <div className={styles.inputWrap}>
                <LockSimple size={16} className={styles.inputIcon} />
                <input
                  className={styles.input}
                  type="password"
                  value={contrasena}
                  onChange={(e) => setContrasena(e.target.value)}
                  autoComplete="off"
                  placeholder="4 dígitos"
                  required
                  maxLength={4}
                />
              </div>
            </label>

            {error ? (
              <motion.p
                className={styles.error}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                role="alert"
              >
                {error}
              </motion.p>
            ) : null}

            <Button type="submit" disabled={sending || !usuario.trim() || !contrasena}>
              {sending ? "Entrando..." : "Iniciar sesión"}
            </Button>
          </motion.form>
        </>
      )}
    </motion.div>
  );
}

export function LoginForm({ initialAdmin }: { initialAdmin: boolean }) {
  return (
    <Suspense fallback={null}>
      <LoginFormInner initialAdmin={initialAdmin} />
    </Suspense>
  );
}
