/** Encabezado de cada pantalla del panel. Mismo ritmo en todas. */
export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[24px] font-light leading-tight sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 text-[13px] text-mute">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** El marco de contenido: mismo ancho y mismos margenes en todo el panel. */
export function PageShell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-5xl px-5 py-6 lg:px-8 lg:py-8">{children}</div>;
}
