import { createClient } from '@supabase/supabase-js'
import WebSocket from 'ws'

const supabaseUrl = process.env['SUPABASE_URL']!
const supabaseKey = process.env['SUPABASE_SERVICE_KEY']!

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  realtime: { transport: WebSocket as any },
})
