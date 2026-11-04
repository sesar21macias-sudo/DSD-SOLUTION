"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Feed } from "@/lib/feed-types";
import { dicts, type Dict, type Lang } from "@/lib/i18n/dict";
import { PLANT_TZ } from "@/lib/dates";
import { BeaufortLogo } from "../BrandMark";
import { BrandMotion } from "./BrandMotion";
import {
  AnnouncementSlide,
  DefectsSlide,
  JobsSlide,
  KpiSlide,
  MessageSlide,
  PhotoSlide,
  RankingsSlide,
  SafetySlide,
  TrendSlide,
  u,
} from "./slides";

/*
 * El reproductor de la tele. Pide su contenido cada minuto; si la red se cae
 * sigue rotando lo último que tenía (nunca se queda en blanco). Las láminas de
 * métricas se intercalan con anuncios y fotos para que la gente voltee a ver.
 */

type Mode = { source: "tv" } | { source: "preview"; team: number | null; lang: Lang; back: string | null; kiosk?: boolean };

type State =
  | { phase: "loading" }
  | { phase: "pairing"; code: string }
  | { phase: "active"; feed: Feed };

interface Slide {
  id: string;
  render: () => React.ReactNode;
  /** Duración propia; si no, la de la pantalla. */
  seconds?: number;
}

/** La intro de marca dura lo que su coreografía más una pausa para leerla. */
const BRAND_SECONDS = 8;

function buildSlides(feed: Feed, d: Dict, mediaUrl: (id: number) => string): Slide[] {
  const metrics: Slide[] = [];
  const plantKicker = `${d.tv.plantKicker} · ${feed.plantName}`;

  if (feed.kind === "team" && feed.team) {
    const teamKicker = `${d.tv.teamKicker} · ${feed.team.name}${feed.team.leader ? ` · ${feed.team.leader}` : ""}`;
    if (feed.teamStats) {
      const st = feed.teamStats;
      metrics.push({
        id: "team-kpi",
        render: () => <KpiSlide stats={st} feed={feed} d={d} kicker={teamKicker} title={feed.team!.name} insight={feed.insight} rank={feed.teamRank} />,
      });
      metrics.push({ id: "team-defects", render: () => <DefectsSlide stats={st} d={d} kicker={teamKicker} /> });
      if (feed.teamJobs.length) metrics.push({ id: "team-jobs", render: () => <JobsSlide jobs={feed.teamJobs} feed={feed} d={d} kicker={teamKicker} /> });
      if (st.trend.length > 1) metrics.push({ id: "team-trend", render: () => <TrendSlide stats={st} feed={feed} d={d} kicker={teamKicker} /> });
    } else {
      metrics.push({ id: "team-empty", render: () => <MessageSlide kicker={teamKicker} title={d.tv.noData} body={d.tv.noDataBody} /> });
    }
    if (feed.rankings?.quality.length) metrics.push({ id: "rankings", render: () => <RankingsSlide feed={feed} d={d} highlight={feed.team!.code} /> });
    if (feed.safety.days !== null) metrics.push({ id: "safety", render: () => <SafetySlide feed={feed} d={d} /> });
  } else {
    if (feed.safety.days !== null) metrics.push({ id: "safety", render: () => <SafetySlide feed={feed} d={d} /> });
    if (feed.plant) {
      const st = feed.plant;
      metrics.push({
        id: "plant-kpi",
        render: () => <KpiSlide stats={st} feed={feed} d={d} kicker={plantKicker} title={d.tv.plantTitle} insight={feed.plantInsight} />,
      });
      if (feed.rankings?.quality.length) metrics.push({ id: "rankings", render: () => <RankingsSlide feed={feed} d={d} /> });
      if (st.trend.length > 1) metrics.push({ id: "plant-trend", render: () => <TrendSlide stats={st} feed={feed} d={d} kicker={plantKicker} /> });
      metrics.push({ id: "plant-defects", render: () => <DefectsSlide stats={st} d={d} kicker={plantKicker} /> });
    } else {
      metrics.push({ id: "plant-empty", render: () => <MessageSlide kicker={plantKicker} title={d.tv.noData} body={d.tv.noDataBody} /> });
    }
  }

  const content: Slide[] = [
    ...feed.announcements.map((a) => ({
      id: `a${a.id}`,
      seconds: a.seconds ?? undefined,
      render: () => <AnnouncementSlide a={a} d={d} mediaUrl={mediaUrl} />,
    })),
    ...feed.photos.map((p) => ({
      id: `p${p.id}`,
      seconds: p.seconds ?? undefined,
      render: () => <PhotoSlide p={p} d={d} mediaUrl={mediaUrl} seconds={p.seconds ?? feed.slideSeconds} />,
    })),
  ];

  // Una lámina de contenido después de cada una de métricas; lo que sobre, al final.
  const out: Slide[] = [
    {
      id: "brand",
      seconds: BRAND_SECONDS,
      render: () => <BrandMotion line="Beaufort Texas" sub={feed.team ? `${d.tv.teamKicker} · ${feed.team.name}` : "Floor Live"} />,
    },
  ];
  let k = 0;
  for (const m of metrics) {
    out.push(m);
    if (k < content.length) out.push(content[k++]);
  }
  return [...out, ...content.slice(k)];
}

function useClock(locale: string) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(t);
  }, []);
  if (!now) return { time: "", date: "" };
  return {
    time: new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", timeZone: PLANT_TZ }).format(now),
    date: (() => {
      const t = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", timeZone: PLANT_TZ }).format(now);
      return t.charAt(0).toUpperCase() + t.slice(1);
    })(),
  };
}

export function Player({ mode, initialLang }: { mode: Mode; initialLang: Lang }) {
  const [state, setState] = useState<State>({ phase: "loading" });
  const [offline, setOffline] = useState(false);
  const [index, setIndex] = useState(0);
  const [cursor, setCursor] = useState(false);
  const cursorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tele real o cuenta de pantalla: no se duerme, recarga sola y no muestra "Salir".
  const kiosk = mode.source === "tv" || (mode.source === "preview" && mode.kiosk === true);
  const lang: Lang = state.phase === "active" ? state.feed.lang : mode.source === "preview" ? mode.lang : initialLang;
  const d = dicts[lang];

  /* ---- Datos ---- */
  const load = useCallback(async (): Promise<number> => {
    try {
      if (mode.source === "preview") {
        const qs = new URLSearchParams({ lang: mode.lang });
        if (mode.team) qs.set("team", String(mode.team));
        const res = await fetch(`/api/vista?${qs}`, { cache: "no-store" });
        if (res.status === 401) {
          window.location.href = "/entrar";
          return 60_000;
        }
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as { feed: Feed };
        setState({ phase: "active", feed: json.feed });
        setOffline(false);
        return 60_000;
      }

      let res = await fetch("/api/tv/feed", { cache: "no-store" });
      if (res.status === 401) {
        // Tele nueva o desconectada: pide código.
        res = await fetch("/api/tv/pair", { method: "POST" });
        const json = (await res.json()) as { status: string; code?: string };
        if (json.status === "pending" && json.code) setState({ phase: "pairing", code: json.code });
        setOffline(false);
        return 4_000;
      }
      if (res.status === 202) {
        const json = (await res.json()) as { code: string | null; expires: string | null };
        if (!json.code || !json.expires || Date.parse(json.expires) < Date.now()) {
          // El código venció: uno nuevo.
          const r2 = await fetch("/api/tv/pair", { method: "POST" });
          const j2 = (await r2.json()) as { code?: string };
          if (j2.code) setState({ phase: "pairing", code: j2.code });
        } else {
          setState({ phase: "pairing", code: json.code });
        }
        setOffline(false);
        return 4_000;
      }
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as { feed: Feed };
      setState({ phase: "active", feed: json.feed });
      setOffline(false);
      return 60_000;
    } catch {
      setOffline(true);
      return 15_000;
    }
  }, [mode]);

  useEffect(() => {
    let stop = false;
    let t: ReturnType<typeof setTimeout>;
    const loop = async () => {
      const next = await load();
      if (!stop) t = setTimeout(loop, next);
    };
    loop();
    return () => {
      stop = true;
      clearTimeout(t);
    };
  }, [load]);

  // Una tele prendida días enteros: recarga cada 6 horas para estrenar versiones y soltar memoria.
  useEffect(() => {
    if (!kiosk) return;
    const t = setTimeout(() => {
      if (navigator.onLine) window.location.reload();
    }, 6 * 3600_000);
    return () => clearTimeout(t);
  }, [kiosk]);

  // Que la tele no se duerma (donde el navegador lo permita).
  useEffect(() => {
    if (!kiosk || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    const get = () =>
      navigator.wakeLock
        .request("screen")
        .then((l) => (lock = l))
        .catch(() => {});
    get();
    const onVis = () => document.visibilityState === "visible" && get();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      lock?.release().catch(() => {});
    };
  }, [kiosk]);

  /* ---- Rotación ---- */
  const feed = state.phase === "active" ? state.feed : null;
  const mediaUrl = useCallback((id: number) => `/api/media/${id}`, []);
  const slides = useMemo(() => (feed ? buildSlides(feed, d, mediaUrl) : []), [feed, d, mediaUrl]);
  const current = slides.length ? slides[index % slides.length] : null;
  const seconds = current?.seconds ?? feed?.slideSeconds ?? 15;

  useEffect(() => {
    if (slides.length <= 1) return;
    const t = setTimeout(() => setIndex((i) => (i + 1) % slides.length), seconds * 1000);
    return () => clearTimeout(t);
  }, [index, slides.length, seconds]);

  // Flechas del teclado o del control remoto: lámina siguiente / anterior.
  useEffect(() => {
    if (slides.length <= 1) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setIndex((i) => (i + 1) % slides.length);
      if (e.key === "ArrowLeft") setIndex((i) => (i - 1 + slides.length) % slides.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [slides.length]);

  // Precarga la foto de la siguiente lámina para que no aparezca a medias.
  useEffect(() => {
    if (!feed || slides.length < 2) return;
    const next = slides[(index + 1) % slides.length];
    const m = /^([ap])(\d+)$/.exec(next.id);
    if (!m) return;
    const id = m[1] === "p" ? Number(m[2]) : feed.announcements.find((a) => a.id === Number(m[2]))?.mediaId;
    if (id) new Image().src = mediaUrl(id);
  }, [index, slides, feed, mediaUrl]);

  const clock = useClock(d.locale);

  const onMove = () => {
    setCursor(true);
    if (cursorTimer.current) clearTimeout(cursorTimer.current);
    cursorTimer.current = setTimeout(() => setCursor(false), 2500);
  };

  const goFullscreen = () => {
    if (kiosk && !document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
  };

  const ticker = feed
    ? [
        ...(feed.safety.days !== null ? [`${feed.safety.days} ${d.tv.safetyDays(feed.safety.days)}`] : []),
        ...feed.announcements.map((a) => a.title || a.body),
      ]
    : [];

  return (
    <div className="tv" data-cursor={cursor} onPointerMove={onMove} onClick={goFullscreen}>
      <div className="tv-stage">
        <div className="tv-glow" aria-hidden="true" />

        {/* Encabezado: marca, de quién es la pantalla, semana y hora */}
        <header className="tv-header">
          <div className="flex flex-col leading-none">
            <BeaufortLogo style={{ height: u(2.5), width: "auto" }} />
            <span className="font-stencil font-bold uppercase text-ink-faint" style={{ fontSize: u(1.0), letterSpacing: "0.3em", marginTop: u(0.5) }}>
              Floor Live
            </span>
          </div>
          <span className="bg-line-strong" style={{ width: 1, height: u(3), marginLeft: u(0.6) }} />
          <span className="truncate font-semibold text-ink-soft" style={{ fontSize: u(1.9) }}>
            {feed ? (feed.team ? feed.team.name : feed.displayName || feed.plantName) : ""}
          </span>

          <div className="ml-auto flex items-center" style={{ gap: u(2.2) }}>
            {offline && (
              <span className="chip-warn rounded-full font-semibold" style={{ fontSize: u(1.3), padding: `${u(0.3)} ${u(1)}` }}>
                {d.tv.offline}
              </span>
            )}
            {feed?.plant && (
              <span className="font-stencil font-extrabold uppercase" style={{ fontSize: u(1.9), letterSpacing: "0.08em" }}>
                {d.tv.week(feed.plant.week)}
              </span>
            )}
            <span className="flex items-center" style={{ gap: u(0.8) }}>
              <span className="live-dot" style={{ width: u(0.7), height: u(0.7) }} />
              <span className="text-right leading-none">
                <span className="tv-num block" style={{ fontSize: u(2.8) }} suppressHydrationWarning>
                  {clock.time}
                </span>
                <span className="block text-ink-faint" style={{ fontSize: u(1.1), marginTop: u(0.3) }} suppressHydrationWarning>
                  {clock.date}
                </span>
              </span>
            </span>
          </div>
        </header>

        <main className="tv-body">
          {state.phase === "loading" && (
            <div className="slide">
              <BrandMotion line="Beaufort Texas" sub="Floor Live" />
            </div>
          )}
          {state.phase === "pairing" && <PairingScreen code={state.code} d={d} />}
          {current && (
            <div key={`${current.id}-${index}`} className="slide">
              <div className="tv-sweep" aria-hidden="true" />
              {current.render()}
            </div>
          )}
        </main>

        {current && slides.length > 1 && (
          <div key={`t-${index}`} className="slide-timer" style={{ animationDuration: `${seconds}s` }} aria-hidden="true" />
        )}

        <footer className="tv-footer">
          <div className="flex flex-none items-center self-stretch bg-red font-stencil font-extrabold uppercase text-white" style={{ padding: `0 ${u(2)}`, fontSize: u(1.5), letterSpacing: "0.12em", zIndex: 1 }}>
            {feed?.plantName ?? "Beaufort"}
          </div>
          <div className="min-w-0 flex-1 overflow-hidden">
            {ticker.length > 0 && (
              <div className="ticker" style={{ "--ticker-s": `${Math.max(30, ticker.join(" ").length * 0.22)}s`, fontSize: u(1.8) } as React.CSSProperties}>
                {ticker.map((t, k) => (
                  <span key={k} className="flex items-center" style={{ gap: u(1.4) }}>
                    <span className="text-red-text">◆</span>
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        </footer>

        <div className="tv-grain" aria-hidden="true" />

        {mode.source === "preview" && mode.back && cursor && (
          <a
            href={mode.back}
            className="btn btn-light absolute"
            style={{ top: u(8), right: u(3), zIndex: 10 }}
            onClick={(e) => e.stopPropagation()}
          >
            {d.tv.exit}
          </a>
        )}
      </div>
    </div>
  );
}

function PairingScreen({ code, d }: { code: string; d: Dict }) {
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.host), []);
  return (
    <div className="slide">
      <div className="flex h-full flex-col items-center justify-center text-center">
        <div data-in className="tv-kicker">{d.tv.pairTitle}</div>
        <p data-in className="text-ink-soft" style={{ fontSize: u(2.4), marginTop: u(1.6), ["--i" as string]: 1 }}>
          {d.tv.pairStep}
        </p>
        <div data-in className="flex" style={{ gap: u(1.2), marginTop: u(3), ["--i" as string]: 2 }}>
          {code.split("").map((c, k) => (
            <span
              key={k}
              className="tv-card tv-num grid place-items-center text-ink"
              style={{ width: u(9.5), height: u(12.5), fontSize: u(9), boxShadow: "0 0 3rem oklch(0.55 0.22 26 / 0.25)" }}
            >
              {c}
            </span>
          ))}
        </div>
        <p data-in className="font-mono text-ink-faint" style={{ fontSize: u(1.8), marginTop: u(3), ["--i" as string]: 3 }}>
          {origin}/pantallas · {d.tv.pairExpires}
        </p>
      </div>
    </div>
  );
}
