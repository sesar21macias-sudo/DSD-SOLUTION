'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'

const specs = [
  { label: 'Reference No.', value: '228235' },
  { label: 'Case Diameter', value: '40 mm' },
  { label: 'Case Material', value: 'Everose gold (18 ct)' },
  { label: 'Movement', value: 'Calibre 3255, Perpetual, self-winding' },
  { label: 'Power Reserve', value: 'Approximately 70 hours' },
  { label: 'Accuracy', value: '−2 / +2 sec per day' },
  { label: 'Crystal', value: 'Scratch-resistant sapphire, Cyclops lens' },
  { label: 'Water Resistance', value: '100 metres / 330 feet' },
  { label: 'Dial', value: 'Chocolate sunburst, diamond-set hour markers' },
  { label: 'Bracelet', value: 'President, 18 ct Everose gold, concealed crown clasp' },
]

export default function SpecsSection() {
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { once: true, margin: '-10%' })

  return (
    <section
      ref={ref}
      style={{
        background: '#000',
        padding: 'clamp(5rem, 10vw, 9rem) clamp(1.5rem, 6vw, 5rem)',
        borderTop: '1px solid rgba(200,169,110,0.12)',
      }}
    >
      <div style={{ maxWidth: '860px' }}>
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
          Technical Specifications
        </motion.p>

        <motion.h2
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
          transition={{ duration: 0.7, delay: 0.1, ease: [0.25, 0, 0, 1] }}
          style={{
            fontFamily: 'var(--font-playfair)',
            fontWeight: 400,
            fontStyle: 'italic',
            fontSize: 'clamp(1.8rem, 3.5vw, 3rem)',
            color: '#fff',
            marginBottom: 'clamp(2.5rem, 5vw, 4rem)',
          }}
        >
          The architecture of precision.
        </motion.h2>

        <div>
          {specs.map((s, i) => (
            <motion.div
              key={s.label}
              animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
              transition={{ duration: 0.6, delay: 0.08 * i, ease: [0.25, 0, 0, 1] }}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '1rem',
                padding: '1.1rem 0',
                borderBottom: '1px solid rgba(255,255,255,0.07)',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-inter)',
                  fontSize: '0.8rem',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: '#C8A96E',
                }}
              >
                {s.label}
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-inter)',
                  fontWeight: 300,
                  fontSize: '0.92rem',
                  color: '#E5E5E5',
                  lineHeight: 1.5,
                }}
              >
                {s.value}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
