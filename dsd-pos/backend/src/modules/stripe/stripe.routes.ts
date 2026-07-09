import { Router } from 'express'
import { createPaymentIntent, confirmStripePayment } from './stripe.controller'

const router = Router()

router.post('/payment-intent', createPaymentIntent)
router.post('/confirm', confirmStripePayment)

export default router
