/**
 * El logotipo. La palabra NICE con mucho tracking sobre un peso ligero: es lo
 * que separa una marca de joyeria de un logo de software.
 */
export function Logo({
  className = "",
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = {
    sm: "text-[13px] tracking-[0.42em]",
    md: "text-[15px] tracking-[0.45em]",
    lg: "text-[22px] tracking-[0.5em]",
  };
  return (
    <span className={`font-light ${sizes[size]} ${className}`} aria-label="NICE">
      NICE
    </span>
  );
}

/** El logo con el descriptor del producto, para cabeceras del panel. */
export function LogoLockup({ className = "" }: { className?: string }) {
  return (
    <span className={`flex flex-col leading-none ${className}`}>
      <Logo size="sm" />
      <span className="mt-1 text-[9px] font-medium uppercase tracking-[0.2em] text-mute">
        Seller Hub
      </span>
    </span>
  );
}
