/**
 * El logotipo de la plataforma: DSD.
 *
 * La marca de la plataforma y la de la joyeria son dos cosas distintas y no
 * deben confundirse. Esto es DSD, el software; lo que se vende adentro es NICE
 * —o manana otra marca— y esa palabra aparece donde de verdad corresponde: el
 * codigo de la pieza, el catalogo, la tienda de cada distribuidora.
 *
 * Mucho tracking sobre un peso ligero: es lo que separa una marca de vitrina
 * de un logo de software.
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
    <span className={`font-light ${sizes[size]} ${className}`} aria-label="DSD">
      DSD
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
