"use client";

interface Props {
  phone: string | null;
  onDisconnect: () => void;
}

export default function DashboardHeader({ phone, onDisconnect }: Props) {
  return (
    <header className="flex items-center justify-between border-b border-neutral-800 px-5 py-3">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-emerald-400" />
        <span className="text-sm font-medium text-neutral-100">
          Conectado {phone ? `· ${phone}` : ""}
        </span>
      </div>
      <button
        type="button"
        onClick={onDisconnect}
        className="rounded-lg border border-neutral-800 px-3 py-1.5 text-xs text-neutral-400 transition-colors hover:border-red-800 hover:text-red-400"
      >
        Desconectar
      </button>
    </header>
  );
}
