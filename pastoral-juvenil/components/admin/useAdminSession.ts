"use client";

import { useCallback, useEffect, useState } from "react";

/** Consulta al servidor si hay sesión de administrador activa (cookie httpOnly). */
export function useAdminSession() {
  const [admin, setAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data: { admin: boolean }) => {
        if (!cancelled) setAdmin(data.admin);
      })
      .catch(() => {
        if (!cancelled) setAdmin(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setAdmin(false);
  }, []);

  return { admin, loading: admin === null, logout };
}
