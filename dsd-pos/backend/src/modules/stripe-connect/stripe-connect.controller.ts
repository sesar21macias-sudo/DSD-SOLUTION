import { Response } from 'express'
import Stripe from 'stripe'
import { supabase } from '../../config/supabase'
import { AuthRequest } from '../../middleware/auth'
import { sendError } from '../../utils/sendError'

function stripeClient() {
  const key = process.env['STRIPE_SECRET_KEY']
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured')
  return new Stripe(key)
}

function resolveFrontend(): string {
  const raw = (process.env['FRONTEND_URL'] ?? '').split(',')[0].trim()
  return raw && !raw.includes('localhost') ? raw : 'http://localhost:3000'
}

// Crea (si no existe) la cuenta conectada de Stripe del negocio y devuelve
// el link de onboarding para que el dueno la termine de configurar el mismo.
// Sin esto, todo el dinero de las ventas cae a la cuenta de la plataforma
// en vez de a la del negocio — el hueco de confianza mas grande del sistema.
export async function startOnboarding(req: AuthRequest, res: Response): Promise<void> {
  const tenantId = req.user!.tenantId
  const stripe = stripeClient()

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name, stripe_account_id')
    .eq('id', tenantId)
    .single()

  if (!tenant) { res.status(404).json({ success: false, error: 'Negocio no encontrado' }); return }

  let accountId = tenant.stripe_account_id as string | null

  if (!accountId) {
    const account = await stripe.accounts.create({
      type: 'express',
      business_profile: { name: tenant.name },
      metadata: { tenant_id: tenantId },
    })
    accountId = account.id
    await supabase.from('tenants').update({ stripe_account_id: accountId }).eq('id', tenantId)
  }

  const FRONTEND = resolveFrontend()
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${FRONTEND}/pos/settings?stripe=refresh`,
    return_url: `${FRONTEND}/pos/settings?stripe=done`,
    type: 'account_onboarding',
  })

  res.json({ success: true, data: { onboarding_url: link.url } })
}

// El dueno regresa del onboarding de Stripe — confirmamos el estado real
// contra la API de Stripe (no confiamos en el query param nada mas).
export async function getConnectStatus(req: AuthRequest, res: Response): Promise<void> {
  const tenantId = req.user!.tenantId
  const { data: tenant } = await supabase
    .from('tenants')
    .select('stripe_account_id, stripe_onboarded')
    .eq('id', tenantId)
    .single()

  if (!tenant?.stripe_account_id) {
    res.json({ success: true, data: { connected: false, charges_enabled: false } })
    return
  }

  try {
    const stripe = stripeClient()
    const account = await stripe.accounts.retrieve(tenant.stripe_account_id)
    const chargesEnabled = !!account.charges_enabled

    if (chargesEnabled !== tenant.stripe_onboarded) {
      await supabase.from('tenants').update({ stripe_onboarded: chargesEnabled }).eq('id', tenantId)
    }

    res.json({ success: true, data: { connected: true, charges_enabled: chargesEnabled } })
  } catch (err) {
    sendError(res, 500, err, 'No se pudo verificar el estado de Stripe')
  }
}
