"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

/**
 * Avisos cortos. Confirman que algo paso —se agrego al carrito, se registro la
 * venta— sin robarle la pantalla a la persona ni obligarla a cerrar nada.
 */

type ToastKind = "success" | "error" | "info";

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  toast: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const STYLES: Record<ToastKind, string> = {
  success: "bg-ink text-white",
  error: "bg-red-600 text-white",
  info: "bg-ink-soft text-white",
};

const ICONS: Record<ToastKind, string> = {
  success: "✓",
  error: "!",
  info: "•",
};

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, kind: ToastKind = "success") => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, kind, message }]);
    // 3.2 s: alcanza a leerse un renglon sin quedarse estorbando.
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3200);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-8"
        role="status"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`animate-scale-in flex max-w-sm items-center gap-2.5 rounded-full px-4 py-2.5 text-[14px] font-medium shadow-lift ${STYLES[t.kind]}`}
          >
            <span className="grid h-4 w-4 place-items-center rounded-full bg-white/20 text-[10px]">
              {ICONS[t.kind]}
            </span>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  // Si alguien usa el hook fuera del provider, mejor que el aviso se pierda a
  // que la pantalla truene por un mensaje de confirmacion.
  return ctx ?? { toast: () => {} };
}
