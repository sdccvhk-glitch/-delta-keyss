# DELTA.KEYS — Automatic Payment + Duration Edition

Railway-ready Express digital-key store with:
- Product-specific durations/plans
- Admin add/edit/delete durations and prices
- Upload keys against a specific product + duration
- Razorpay Standard Checkout
- Server-side payment signature verification
- Optional payment webhooks for near-real-time fulfillment
- Automatic key allocation after verified payment
- Customer order/status page
- Username/password admin login

## Railway variables

Required admin:
- ADMIN_USER
- ADMIN_PASSWORD

Automatic Razorpay payments:
- RAZORPAY_KEY_ID
- RAZORPAY_KEY_SECRET
- RAZORPAY_WEBHOOK_SECRET (recommended for webhook fulfillment)

Optional:
- PAYMENT_PAYEE_NAME=DELTA.KEYS

## Payment flow

1. Customer selects a product and duration.
2. Server creates a Razorpay order using the server-side secret.
3. Customer completes checkout.
4. The server verifies the Razorpay signature.
5. The server allocates a key matching the product + duration.
6. The key is shown to the customer immediately after verified payment.
7. The webhook endpoint `/api/payments/webhook` can also fulfill the order from `order.paid` / `payment.captured`.

Do not put the Razorpay secret in HTML or frontend JavaScript. Razorpay recommends creating Orders server-side and verifying the payment signature server-side before fulfilling an order.

## Admin duration management

Open Admin → Durations:
- Select a product
- Add a duration name
- Set duration hours (0 means Lifetime)
- Set price
- Edit or delete existing durations

When uploading keys, select both the product and the matching duration. Keys are then automatically reserved for that plan.

## Important

The ZIP contains the integration code, but live automatic payments require an authorized payment-gateway merchant account and the corresponding Railway environment variables. Test the integration in the gateway's test mode before enabling live payments.
