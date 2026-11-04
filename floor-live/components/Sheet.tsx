"use client";

import { useEffect, useRef } from "react";
import { useDict } from "./I18n";
import { IconClose } from "./Icons";

/** <dialog> nativo: foco atrapado, Esc y fondo inerte sin librerías. */
export function Sheet({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** Más ancho en escritorio (editores con vista previa). */
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const d = useDict();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      // showModal enfoca el botón de cerrar (primero en el DOM); queremos el primer campo.
      el.querySelector<HTMLElement>("input:not([type=hidden]), textarea, select")?.focus();
    }
    if (!open && el.open) el.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={wide ? "sheet sheet-wide" : "sheet"}
      aria-label={title}
      style={{ zIndex: "var(--z-modal)" }}
      onClose={onClose}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      {open && (
        <div className="sheet-panel">
          <div className="sheet-handle" aria-hidden="true" />
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="font-display text-[1.75rem] leading-none tracking-[-0.01em]">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={d.common.close}
              className="-mr-1 grid h-9 w-9 place-items-center rounded-full bg-surface-2 text-ink-soft transition-colors hover:bg-surface-3 hover:text-ink"
            >
              <IconClose size={16} />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
