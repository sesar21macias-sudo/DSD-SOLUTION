import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env['SUPABASE_URL']!
const supabaseKey = process.env['SUPABASE_SERVICE_KEY']!

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables')
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const ws = require('ws')

export const supabase = createClient(supabaseUrl, supabaseKey, {
  realtime: { transport: ws },
})
