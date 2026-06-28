'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'

export default function ClosingCTA() {
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { once: true, margin: '-10%' })

  return (
    <section
      ref={ref}
      style={{
        background: '#000',
        padding: 'clamp(6rem, 12vw, 11rem) clamp(1.5rem, 6vw, 5rem)',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        borderTop: '1px solid rgba(200,169,110,0.12)',
        position: 'relative',
      }}
    >
      {/* radial glow */}
      <div
        style={{
          position: 'absolute',
          bottom: '10%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '600px',
          height: '300px',
          background: 'radial-gradient(ellipse, rgba(200,169,110,0.10) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <motion.p
        animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
        transition={{ duration: 0.7, ease: [0.25, 0, 0, 1] }}
        style={{
          fontFamily: 'var(--font-inter)',
          fontSize: '0.65rem',
          letterSpacing: '0.25em',
          textTransform: 'uppercase',
          color: '#C8A96E',
          marginBottom: '2rem',
        }}
      >
        Yours to Command
      </motion.p>

      <motion.h2
        animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
        transition={{ duration: 0.7, delay: 0.1, ease: [0.25, 0, 0, 1] }}
        style={{
          fontFamily: 'var(--font-playfair)',
          fontWeight: 400,
          fontSize: 'clamp(2.2rem, 5vw, 4.5rem)',
          lineHeight: 1.12,
          marginBottom: '1.5rem',
          maxWidth: '16ch',
        }}
      >
        <span style={{ color: '#fff' }}>A century of mastery.</span>
        <br />
        <span style={{ color: '#E5E5E5', fontStyle: 'italic' }}>One expression of it.</span>
      </motion.h2>

      <motion.p
        animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
        transition={{ duration: 0.7, delay: 0.2, ease: [0.25, 0, 0, 1] }}
        style={{
          fontFamily: 'var(--font-inter)',
          fontWeight: 300,
          fontSize: 'clamp(0.9rem, 1.4vw, 1.05rem)',
          color: '#E5E5E5',
          maxWidth: '480px',
          lineHeight: 1.7,
          marginBottom: '3rem',
        }}
      >
        The Day-Date 40 is reserved for those who set the agenda. Visit an
        authorised Rolex retailer to hold it, feel it, and make it yours.
      </motion.p>

      <motion.div
        animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
        transition={{ duration: 0.7, delay: 0.3, ease: [0.25, 0, 0, 1] }}
      >
        <motion.a
          href="#"
          whileHover={{ background: '#000', color: '#C8A96E' }}
          style={{
            display: 'inline-block',
            background: '#C8A96E',
            color: '#000',
            fontFamily: 'var(--font-inter)',
            fontWeight: 500,
            fontSize: '0.7rem',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            textDecoration: 'none',
            padding: '0.9rem 2.6rem',
            border: '1px solid #C8A96E',
            transition: 'background 0.25s, color 0.25s',
          }}
        >
          Find an Authorised Retailer
        </motion.a>
      </motion.div>
    </section>
  )
}
