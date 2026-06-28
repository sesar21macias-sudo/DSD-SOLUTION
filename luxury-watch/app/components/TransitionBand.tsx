'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'

export default function TransitionBand() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-5%' })

  return (
    <div
      ref={ref}
      style={{
        background: '#000',
        padding: '4rem clamp(1.5rem, 6vw, 5rem)',
        display: 'flex',
        alignItems: 'center',
        gap: '2rem',
        overflow: 'hidden',
      }}
    >
      <motion.div
        animate={inView ? { scaleX: 1, opacity: 1 } : { scaleX: 0, opacity: 0 }}
        transition={{ duration: 1.1, ease: [0.25, 0, 0, 1] }}
        style={{
          flex: 1,
          height: '1px',
          background: 'linear-gradient(to right, transparent, rgba(200,169,110,0.5), transparent)',
          transformOrigin: 'left',
        }}
      />
      <motion.p
        animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
        transition={{ duration: 0.7, delay: 0.4, ease: 'easeOut' }}
        style={{
          fontFamily: 'var(--font-inter)',
          fontSize: '0.6rem',
          letterSpacing: '0.3em',
          textTransform: 'uppercase',
          color: '#888',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        Rolex · Day‑Date 40 · Ref. 228235
      </motion.p>
      <motion.div
        animate={inView ? { scaleX: 1, opacity: 1 } : { scaleX: 0, opacity: 0 }}
        transition={{ duration: 1.1, ease: [0.25, 0, 0, 1] }}
        style={{
          flex: 1,
          height: '1px',
          background: 'linear-gradient(to left, transparent, rgba(200,169,110,0.5), transparent)',
          transformOrigin: 'right',
        }}
      />
    </div>
  )
}
