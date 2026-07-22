type FlameIconProps = {
  size?: number;
  className?: string;
};

export function FlameIcon({ size = 24, className }: FlameIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M12 2.5c1.2 2.4 3.6 4.1 3.6 7.3a3.6 3.6 0 0 1-7.2 0c0-1 .3-1.8.8-2.6-1.4.9-2.4 2.6-2.4 4.6a4.9 4.9 0 0 0 9.8 0c0-4-2.6-6.3-4.6-9.3Z"
        fill="url(#flame-gradient)"
      />
      <path
        d="M12 12.4a1.7 1.7 0 0 1-1.7-1.7c0-.75.55-1.35 1.1-1.95.2.7.9 1.25 1.6 1.6a1.7 1.7 0 0 1-1 2.05Z"
        fill="var(--panel, #fbf7ec)"
        opacity="0.85"
      />
      <defs>
        <linearGradient id="flame-gradient" x1="12" y1="2.5" x2="12" y2="21.5" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--logo-amarillo, #ffd400)" />
          <stop offset="0.5" stopColor="var(--logo-naranja, #f0902c)" />
          <stop offset="1" stopColor="var(--logo-rojo, #ff4a3d)" />
        </linearGradient>
      </defs>
    </svg>
  );
}
