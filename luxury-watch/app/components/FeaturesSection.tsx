'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'

const features = [
  {
    title: 'Perpetual Movement',
    copy: 'The calibre 3255 self-winding mechanism winds itself through the natural motion of the wrist, ensuring the watch never requires manual winding.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="#C8A96E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="14" cy="14" r="10" />
        <polyline points="14,7 14,14 18,17" />
      </svg>
    ),
  },
  {
    title: 'Everose Gold',
    copy: "Rolex's proprietary 18 ct pink gold alloy resists fading and maintains its warm, rose hue across decades of daily wear.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="#C8A96E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="14,3 17,11 26,11 19,16 22,24 14,19 6,24 9,16 2,11 11,11" />
      </svg>
    ),
  },
  {
    title: 'Oyster Waterproofing',
    copy: 'The hermetically sealed Oyster case is waterproof to 100 metres — a fortress of impeccable engineering around the movement within.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="#C8A96E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 3 C14 3 5 10 5 17 a9 9 0 0 0 18 0 C23 10 14 3 14 3z" />
      </svg>
    ),
  },
  {
    title: 'President Bracelet',
    copy: 'Three semi-circular links of solid gold form the iconic President bracelet, engineered for elegance and comfort in equal measure.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="#C8A96E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="22" height="6" rx="3" />
        <line x1="8" y1="11" x2="8" y2="17" />
        <line x1="14" y1="11" x2="14" y2="17" />
        <line x1="20" y1="11" x2="20" y2="17" />
      </svg>
    ),
  },
  {
    title: 'Superlative Chronometer',
    copy: 'Certified to the most exacting timekeeping standards in the industry: accuracy of −2/+2 seconds per day, well beyond COSC certification.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="#C8A96E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="14" cy="15" r="10" />
        <line x1="14" y1="5" x2="14" y2="3" />
        <line x1="10" y1="3.5" x2="11" y2="5.4" />
        <line x1="18" y1="3.5" x2="17" y2="5.4" />
        <line x1="14" y1="15" x2="18" y2="11" />
      </svg>
    ),
  },
  {
    title: 'Cyclops Date',
    copy: 'A magnifying Cyclops lens at 3 o\'clock amplifies the date 2.5 times, offering effortless legibility without compromising the dial\'s purity.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="#C8A96E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="14" cy="14" rx="11" ry="7" />
        <circle cx="14" cy="14" r="3" />
      </svg>
    ),
  },
]

export default function FeaturesSection() {
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { once: true, margin: '-10%' })

  return (
    <section
      ref={ref}
      id="collection"
      style={{
        background: '#000',
        padding: 'clamp(5rem, 10vw, 9rem) clamp(1.5rem, 6vw, 5rem)',
      }}
    >
      <motion.p
        animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
        transition={{ duration: 0.7, ease: [0.25, 0, 0, 1] }}
        style={{
          fontFamily: 'var(--font-inter)',
          fontSize: '0.65rem',
          letterSpacing: '0.25em',
          textTransform: 'uppercase',
          color: '#C8A96E',
          marginBottom: '1.2rem',
        }}
      >
        Crafted Without Compromise
      </motion.p>

      <motion.h2
        animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
        transition={{ duration: 0.7, delay: 0.1, ease: [0.25, 0, 0, 1] }}
        style={{
          fontFamily: 'var(--font-playfair)',
          fontWeight: 400,
          fontSize: 'clamp(2rem, 4vw, 3.5rem)',
          color: '#fff',
          marginBottom: 'clamp(3rem, 6vw, 5rem)',
          maxWidth: '18ch',
        }}
      >
        Six pillars of mastery.
      </motion.h2>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '0',
        }}
      >
        {features.map((f, i) => (
          <motion.div
            key={f.title}
            animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
            transition={{ duration: 0.7, delay: 0.1 * i, ease: [0.25, 0, 0, 1] }}
            style={{
              borderTop: '1px solid rgba(200,169,110,0.2)',
              padding: '2.4rem 2rem 2.4rem 0',
              paddingRight: 'clamp(1rem, 3vw, 2.5rem)',
            }}
          >
            <div style={{ marginBottom: '1.2rem' }}>{f.icon}</div>
            <p
              style={{
                fontFamily: 'var(--font-inter)',
                fontSize: '0.65rem',
                letterSpacing: '0.25em',
                textTransform: 'uppercase',
                color: '#C8A96E',
                marginBottom: '0.75rem',
              }}
            >
              {f.title}
            </p>
            <p
              style={{
                fontFamily: 'var(--font-inter)',
                fontWeight: 300,
                fontSize: '0.95rem',
                color: '#E5E5E5',
                lineHeight: 1.7,
              }}
            >
              {f.copy}
            </p>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
