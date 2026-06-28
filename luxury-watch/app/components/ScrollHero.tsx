'use client'

import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'

const ASSEMBLED =
  'https://d8j0ntlcm91z4.cloudfront.net/user_3FMdnRLO3CvC2dezWAgPw4s5Jup/hf_20260619_230643_e51921c4-3cde-4d06-9756-fbc694ff2055.png'
const EXPLODED =
  'https://d8j0ntlcm91z4.cloudfront.net/user_3FMdnRLO3CvC2dezWAgPw4s5Jup/hf_20260619_230719_23154c51-8aac-4f29-8a60-a547793f98b6.png'

export default function ScrollHero() {
  const containerRef = useRef<HTMLDivElement>(null)
  const explodedRef = useRef<HTMLDivElement>(null)
  const scaleRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    function loop() {
      const container = containerRef.current
      const exploded = explodedRef.current
      const scaleEl = scaleRef.current
      if (!container || !exploded || !scaleEl) {
        rafRef.current = requestAnimationFrame(loop)
        return
      }

      const top = container.getBoundingClientRect().top
      const scrollable = container.offsetHeight - window.innerHeight
      const raw = Math.max(0, Math.min(1, -top / scrollable))

      // crossfade: assembled→exploded over first 70% of scroll
      const fade = Math.min(1, raw / 0.7)
      exploded.style.opacity = String(fade)

      // subtle scale: assembled shrinks slightly as exploded appears
      const scale = 1 + raw * 0.06
      scaleEl.style.transform = `scale(${scale})`

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  const fadeUp = (delay: number) => ({
    hidden: { opacity: 0, y: 28 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { delay, duration: 0.9, ease: 'easeOut' },
    },
  })

  return (
    <div ref={containerRef} style={{ height: '300vh', position: 'relative' }}>
      <div
        style={{
          position: 'sticky',
          top: 0,
          width: '100vw',
          height: '100vh',
          overflow: 'hidden',
          background: '#000',
        }}
      >
        {/* assembled watch — base layer */}
        <div
          ref={scaleRef}
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url(${ASSEMBLED})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            willChange: 'transform',
          }}
        />

        {/* exploded view — fades in on scroll */}
        <div
          ref={explodedRef}
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url(${EXPLODED})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0,
            willChange: 'opacity',
          }}
        />

        {/* vignette gradient */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.72) 100%)',
            pointerEvents: 'none',
          }}
        />

        {/* bottom gradient behind text */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.3) 45%, transparent 100%)',
            pointerEvents: 'none',
          }}
        />

        {/* scroll cue line */}
        <ScrollCue />

        {/* text overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            padding: 'clamp(2rem, 5vw, 4.5rem)',
            pointerEvents: 'none',
          }}
        >
          <motion.p
            variants={fadeUp(0.7)}
            initial="hidden"
            animate="visible"
            style={{
              fontFamily: 'var(--font-inter)',
              fontSize: '0.65rem',
              letterSpacing: '0.28em',
              textTransform: 'uppercase',
              color: '#C8A96E',
              marginBottom: '1rem',
            }}
          >
            Est. 1905 · Geneva
          </motion.p>

          <motion.h1
            variants={fadeUp(0.88)}
            initial="hidden"
            animate="visible"
            style={{
              fontFamily: 'var(--font-playfair)',
              fontWeight: 400,
              fontSize: 'clamp(2.6rem, 6.5vw, 5.8rem)',
              lineHeight: 1.06,
              color: '#fff',
              marginBottom: '1.2rem',
              maxWidth: '12ch',
            }}
          >
            Day‑Date 40
          </motion.h1>

          <motion.p
            variants={fadeUp(1.05)}
            initial="hidden"
            animate="visible"
            style={{
              fontFamily: 'var(--font-inter)',
              fontWeight: 300,
              fontSize: 'clamp(0.9rem, 1.5vw, 1.08rem)',
              color: '#E5E5E5',
              maxWidth: '430px',
              lineHeight: 1.7,
              marginBottom: '2.2rem',
            }}
          >
            Forged from Everose gold, driven by a perpetual movement of
            uncompromising precision — the standard by which all others are
            measured.
          </motion.p>

          <motion.div
            variants={fadeUp(1.2)}
            initial="hidden"
            animate="visible"
            style={{ pointerEvents: 'auto' }}
          >
            <a
              href="#features"
              style={{
                display: 'inline-block',
                background: '#C8A96E',
                color: '#000',
                fontFamily: 'var(--font-inter)',
                fontWeight: 500,
                fontSize: '0.68rem',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                textDecoration: 'none',
                padding: '0.9rem 2.6rem',
              }}
            >
              Explore Collection
            </a>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

function ScrollCue() {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: '2.5rem',
        right: 'clamp(2rem, 5vw, 4.5rem)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.5rem',
        pointerEvents: 'none',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-inter)',
          fontSize: '0.6rem',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: '#888',
          writingMode: 'vertical-rl',
          marginBottom: '0.5rem',
        }}
      >
        Scroll
      </span>
      <div
        style={{
          width: '1px',
          height: '48px',
          background: 'linear-gradient(to bottom, #C8A96E, transparent)',
          animation: 'scrollLine 1.8s ease-in-out infinite',
        }}
      />
      <style>{`
        @keyframes scrollLine {
          0%   { opacity: 0; transform: scaleY(0); transform-origin: top; }
          50%  { opacity: 1; transform: scaleY(1); transform-origin: top; }
          100% { opacity: 0; transform: scaleY(1); transform-origin: bottom; }
        }
      `}</style>
    </div>
  )
}
