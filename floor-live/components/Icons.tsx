/** Íconos de trazo, 1.6px, al estilo de SF Symbols. Heredan currentColor. */
type P = { size?: number; className?: string };

function Svg({ size = 20, className, children }: P & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

export const IconPanel = (p: P) => (
  <Svg {...p}>
    <path d="M4 13a8 8 0 1 1 16 0" />
    <path d="M12 13l4-4" />
    <path d="M4 17h16" />
  </Svg>
);
export const IconOrders = (p: P) => (
  <Svg {...p}>
    <rect x="4" y="3.5" width="16" height="17" rx="2.5" />
    <path d="M8 8h8M8 12h8M8 16h5" />
  </Svg>
);
export const IconTasks = (p: P) => (
  <Svg {...p}>
    <path d="M4.5 6.5l1.8 1.8L9.5 5" />
    <path d="M4.5 13.5l1.8 1.8L9.5 12" />
    <path d="M13 7h7M13 14h7M5 20h15" />
  </Svg>
);
export const IconTeam = (p: P) => (
  <Svg {...p}>
    <circle cx="9" cy="8.5" r="3.2" />
    <path d="M3.5 19c.7-3 2.9-4.6 5.5-4.6s4.8 1.6 5.5 4.6" />
    <circle cx="17" cy="9.5" r="2.4" />
    <path d="M16.5 14.6c2 .2 3.4 1.6 4 4" />
  </Svg>
);
export const IconPlus = (p: P) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);
export const IconChevron = (p: P) => (
  <Svg {...p}>
    <path d="M9.5 6l6 6-6 6" />
  </Svg>
);
export const IconBack = (p: P) => (
  <Svg {...p}>
    <path d="M14.5 6l-6 6 6 6" />
  </Svg>
);
export const IconCamera = (p: P) => (
  <Svg {...p}>
    <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.4l1.4-2h5.4l1.4 2h1.4A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z" />
    <circle cx="12" cy="12.5" r="3.4" />
  </Svg>
);
export const IconCheck = (p: P) => (
  <Svg {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Svg>
);
export const IconClose = (p: P) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);
export const IconClock = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Svg>
);
export const IconAlert = (p: P) => (
  <Svg {...p}>
    <path d="M12 4l9 16H3z" />
    <path d="M12 10v4M12 17.2v.1" />
  </Svg>
);
export const IconEdit = (p: P) => (
  <Svg {...p}>
    <path d="M4 20h4L19 9l-4-4L4 16z" />
    <path d="M13.5 6.5l4 4" />
  </Svg>
);
export const IconTrash = (p: P) => (
  <Svg {...p}>
    <path d="M5 7h14M10 4h4M7 7l.8 12a1.5 1.5 0 0 0 1.5 1.4h5.4a1.5 1.5 0 0 0 1.5-1.4L17 7" />
  </Svg>
);
export const IconUser = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="8.5" r="3.5" />
    <path d="M5 20c.9-3.6 3.6-5.5 7-5.5s6.1 1.9 7 5.5" />
  </Svg>
);
export const IconSend = (p: P) => (
  <Svg {...p}>
    <path d="M12 19V5M6 11l6-6 6 6" />
  </Svg>
);
export const IconBox = (p: P) => (
  <Svg {...p}>
    <path d="M4 8l8-4 8 4v8l-8 4-8-4z" />
    <path d="M4 8l8 4 8-4M12 12v8" />
  </Svg>
);
export const IconPhoto = (p: P) => (
  <Svg {...p}>
    <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="M20.5 15.5l-5-5-9 8.5" />
  </Svg>
);
export const IconFile = (p: P) => (
  <Svg {...p}>
    <path d="M7 3.5h6.5L18.5 8.5v11a1.5 1.5 0 0 1-1.5 1.5H7a1.5 1.5 0 0 1-1.5-1.5v-15A1.5 1.5 0 0 1 7 3.5z" />
    <path d="M13 3.5V9h5.5" />
  </Svg>
);
export const IconDownload = (p: P) => (
  <Svg {...p}>
    <path d="M12 4.5v10.5M7.5 10.5L12 15l4.5-4.5M5 19.5h14" />
  </Svg>
);
export const IconPaperclip = (p: P) => (
  <Svg {...p}>
    <path d="M18.5 11.5l-6.4 6.4a4 4 0 0 1-5.7-5.7l7-7a2.7 2.7 0 0 1 3.8 3.8l-7 7a1.3 1.3 0 0 1-1.9-1.9l6.4-6.4" />
  </Svg>
);

export const IconTv = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="5" width="18" height="12" rx="2" />
    <path d="M8 20.5h8M12 17v3.5" />
  </Svg>
);

export const IconUpload = (p: P) => (
  <Svg {...p}>
    <path d="M12 15.5V4M7.5 8.5L12 4l4.5 4.5" />
    <path d="M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3" />
  </Svg>
);

export const IconMegaphone = (p: P) => (
  <Svg {...p}>
    <path d="M4 10v4h3l8 5V5L7 10z" />
    <path d="M18.5 9.5a3.5 3.5 0 010 5" />
  </Svg>
);

export const IconSpark = (p: P) => (
  <Svg {...p}>
    <path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z" />
    <path d="M18.5 16.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
  </Svg>
);

export const IconPlay = (p: P) => (
  <Svg {...p}>
    <path d="M8 5.5v13l10.5-6.5z" />
  </Svg>
);
