import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '../../config/supabase'

const anthropic = new Anthropic({ apiKey: process.env['ANTHROPIC_API_KEY'] })

function rangeDays(days: number) {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - days)
  return { start: start.toISOString(), end: end.toISOString() }
}

// Herramientas que el modelo puede llamar — cada una consulta datos reales
// del negocio (Supabase), nunca inventa numeros.
const tools: Anthropic.Tool[] = [
  {
    name: 'get_sales_summary',
    description: 'Resumen de ventas de los ultimos N dias: total, numero de ordenes, ticket promedio.',
    input_schema: { type: 'object', properties: { days: { type: 'number', description: 'dias hacia atras, default 7' } } },
  },
  {
    name: 'get_top_products',
    description: 'Los productos mas vendidos en los ultimos N dias.',
    input_schema: { type: 'object', properties: { days: { type: 'number' }, limit: { type: 'number' } } },
  },
  {
    name: 'get_low_stock',
    description: 'Ingredientes con inventario bajo (por debajo del minimo configurado).',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_pending_orders',
    description: 'Ordenes activas ahora mismo (no pagadas ni canceladas).',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_cancellations_and_discounts',
    description: 'Ordenes canceladas y descuentos aplicados en los ultimos N dias, con quien lo hizo — para detectar posible fraude o error de caja.',
    input_schema: { type: 'object', properties: { days: { type: 'number' } } },
  },
  {
    name: 'get_sales_by_weekday',
    description: 'Ventas promedio por dia de la semana en las ultimas semanas — util para decidir cuanto comprar/preparar cada dia.',
    input_schema: { type: 'object', properties: {} },
  },
]

async function runTool(name: string, input: any, tenantId: string): Promise<unknown> {
  if (name === 'get_sales_summary') {
    const { start } = rangeDays(input.days ?? 7)
    const { data } = await supabase.from('orders').select('total, status').eq('tenant_id', tenantId).gte('created_at', start)
    const paid = (data ?? []).filter(o => ['paid', 'delivered'].includes(o.status))
    const total = paid.reduce((s, o) => s + Number(o.total), 0)
    return { total_revenue: Math.round(total * 100) / 100, orders: paid.length, avg_ticket: paid.length ? Math.round((total / paid.length) * 100) / 100 : 0 }
  }
  if (name === 'get_top_products') {
    const { start } = rangeDays(input.days ?? 7)
    const { data } = await supabase.from('order_items').select('quantity, subtotal, menu_products(name), created_at').eq('tenant_id', tenantId).gte('created_at', start)
    const map = new Map<string, { qty: number; revenue: number }>()
    for (const item of data ?? []) {
      const name2 = (item.menu_products as any)?.name ?? 'Desconocido'
      const cur = map.get(name2) ?? { qty: 0, revenue: 0 }
      cur.qty += item.quantity; cur.revenue += Number(item.subtotal)
      map.set(name2, cur)
    }
    return Array.from(map.entries()).map(([name2, v]) => ({ name: name2, ...v })).sort((a, b) => b.qty - a.qty).slice(0, input.limit ?? 5)
  }
  if (name === 'get_low_stock') {
    const { data } = await supabase.from('ingredients').select('name, stock, min_stock, unit').eq('tenant_id', tenantId)
    return (data ?? []).filter(i => Number(i.stock) <= Number(i.min_stock))
  }
  if (name === 'get_pending_orders') {
    const { data } = await supabase.from('orders').select('order_number, type, status, total, customer_name').eq('tenant_id', tenantId).not('status', 'in', '(paid,cancelled)')
    return data ?? []
  }
  if (name === 'get_cancellations_and_discounts') {
    const { start } = rangeDays(input.days ?? 14)
    const { data } = await supabase.from('audit_log').select('action, user_id, metadata, created_at, users(full_name)').eq('tenant_id', tenantId)
      .in('action', ['order.cancel', 'order.discount']).gte('created_at', start)
    return data ?? []
  }
  if (name === 'get_sales_by_weekday') {
    const { start } = rangeDays(56)
    const { data } = await supabase.from('orders').select('total, created_at, status').eq('tenant_id', tenantId).gte('created_at', start).in('status', ['paid', 'delivered'])
    const days = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado']
    const buckets: Record<string, { total: number; count: number }> = {}
    for (const d of days) buckets[d] = { total: 0, count: 0 }
    for (const o of data ?? []) {
      const day = days[new Date(o.created_at).getDay()]
      buckets[day].total += Number(o.total); buckets[day].count += 1
    }
    return Object.entries(buckets).map(([day, v]) => ({ day, avg_revenue: v.count ? Math.round((v.total / (v.count / 8)) * 100) / 100 : 0, orders_total: v.count }))
  }
  return { error: 'Herramienta desconocida' }
}

const SYSTEM_PROMPT = `Eres el asistente de negocio del dueno de un restaurante que usa DSD POS. Respondes en español, tono directo y util, como un socio que conoce el negocio.
Usa SIEMPRE las herramientas para obtener numeros reales — nunca inventes cifras. Si una herramienta devuelve vacio, dilo claramente en vez de inventar.
Se breve: el dueno esta ocupado, dale la respuesta y 1-2 recomendaciones accionables si aplica, no un ensayo.`

export async function chatWithAssistant(tenantId: string, message: string, history: { role: 'user' | 'assistant'; content: string }[]): Promise<string> {
  const messages: Anthropic.MessageParam[] = [...history, { role: 'user', content: message }]

  for (let i = 0; i < 4; i++) {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools,
      messages,
    })

    const toolUses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
    if (toolUses.length === 0) {
      const text = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text')
      return text?.text ?? 'No pude generar una respuesta.'
    }

    messages.push({ role: 'assistant', content: response.content })
    const toolResults: Anthropic.ToolResultBlockParam[] = []
    for (const use of toolUses) {
      const result = await runTool(use.name, use.input, tenantId)
      toolResults.push({ type: 'tool_result', tool_use_id: use.id, content: JSON.stringify(result) })
    }
    messages.push({ role: 'user', content: toolResults })
  }
  return 'No pude completar la consulta, intenta de nuevo con una pregunta mas especifica.'
}
