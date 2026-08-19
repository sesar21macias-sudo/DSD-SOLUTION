'use client'

import { useState, useRef, useEffect } from 'react'
import { api } from '@/lib/api'
import { Sparkles, X, Send, Loader2 } from 'lucide-react'

interface Msg { role: 'user' | 'assistant'; content: string }

export function BusinessAssistant() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, open])

  async function send() {
    const text = input.trim()
    if (!text || loading) return
    const history = messages.slice(-10)
    setMessages(m => [...m, { role: 'user', content: text }])
    setInput('')
    setLoading(true)
    try {
      const { data } = await api.post('/assistant/chat', { message: text, history })
      setMessages(m => [...m, { role: 'assistant', content: data.data.reply }])
    } catch {
      setMessages(m => [...m, { role: 'assistant', content: 'No pude responder ahora mismo, intenta de nuevo.' }])
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        style={{ position: 'fixed', bottom: 22, right: 22, zIndex: 60, width: 54, height: 54, borderRadius: '50%', background: '#111827', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(0,0,0,0.25)' }}
        aria-label="Abrir asistente de negocio">
        <Sparkles size={22} />
      </button>
    )
  }

  return (
    <div style={{ position: 'fixed', bottom: 22, right: 22, zIndex: 60, width: 360, maxWidth: 'calc(100vw - 32px)', height: 480, maxHeight: 'calc(100vh - 64px)', background: '#fff', borderRadius: 16, boxShadow: '0 20px 50px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid #e5e7eb' }}>
      <div style={{ padding: '14px 16px', background: '#111827', color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Sparkles size={16} />
        <span style={{ fontWeight: 700, fontSize: 14, flex: 1 }}>Asistente del negocio</span>
        <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={18} /></button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.length === 0 && (
          <p style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', marginTop: 30 }}>
            Preguntame como van las ventas, que se esta agotando, o si hay algo raro en caja.
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%', background: m.role === 'user' ? '#111827' : '#f3f4f6', color: m.role === 'user' ? '#fff' : '#111827', padding: '9px 12px', borderRadius: 12, fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
            {m.content}
          </div>
        ))}
        {loading && <div style={{ alignSelf: 'flex-start', color: '#9ca3af' }}><Loader2 size={16} className="animate-spin" /></div>}
        <div ref={bottomRef} />
      </div>
      <div style={{ padding: 10, borderTop: '1px solid #e5e7eb', display: 'flex', gap: 8 }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Pregunta algo del negocio..." disabled={loading}
          style={{ flex: 1, padding: '9px 12px', borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 13, outline: 'none' }} />
        <button onClick={send} disabled={loading || !input.trim()}
          style={{ background: '#111827', color: '#fff', border: 'none', width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: loading || !input.trim() ? 0.5 : 1 }}>
          <Send size={15} />
        </button>
      </div>
    </div>
  )
}
