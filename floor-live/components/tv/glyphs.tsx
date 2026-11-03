import type { Tone } from "@/lib/status";
import type { AnnouncementKind } from "@/lib/types";

/** Íconos de trazo para la tele. Tamaño en `em`: crecen con el texto que acompañan. */

type P = { className?: string; style?: React.CSSProperties };

function Svg({ children, className, style }: P & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      style={style}
    >
      {children}
    </svg>
  );
}

export function ToneGlyph({ tone, ...p }: P & { tone: Tone }) {
  if (tone === "good")
    return (
      <Svg {...p}>
        <circle cx="12" cy="12" r="9.5" />
        <path d="M7.5 12.3l3 3 6-6.3" />
      </Svg>
    );
  if (tone === "warn")
    return (
      <Svg {...p}>
        <path d="M12 3.5l9.5 16.5h-19z" />
        <path d="M12 10v4.2M12 17.2v.1" />
      </Svg>
    );
  if (tone === "bad")
    return (
      <Svg {...p}>
        <path d="M8 3h8l5 5v8l-5 5H8l-5-5V8z" />
        <path d="M12 7.5v5.5M12 16.4v.1" />
      </Svg>
    );
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M8 12h8" />
    </Svg>
  );
}

export function Shield(p: P) {
  return (
    <Svg {...p}>
      <path d="M12 2.8l8 3v6.1c0 4.6-3.3 8.3-8 9.3-4.7-1-8-4.7-8-9.3V5.8z" />
      <path d="M8.3 12.2l2.6 2.6 4.9-5.2" />
    </Svg>
  );
}

export function Spark(p: P) {
  return (
    <Svg {...p}>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.5 2.5M15.2 15.2l2.5 2.5M6.3 17.7l2.5-2.5M15.2 8.8l2.5-2.5" />
    </Svg>
  );
}

export function KindGlyph({ kind, ...p }: P & { kind: AnnouncementKind }) {
  if (kind === "celebration")
    return (
      <Svg {...p}>
        <path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z" />
      </Svg>
    );
  if (kind === "safety") return <Shield {...p} />;
  if (kind === "reminder")
    return (
      <Svg {...p}>
        <path d="M6 16V11a6 6 0 1112 0v5l1.5 2h-15z" />
        <path d="M10 20.5a2.2 2.2 0 004 0" />
      </Svg>
    );
  return (
    <Svg {...p}>
      <path d="M4 10v4h3l7 4.5v-13L7 10z" />
      <path d="M17.5 9a4 4 0 010 6" />
    </Svg>
  );
}
