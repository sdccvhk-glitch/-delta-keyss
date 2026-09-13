# DELTA.KEYS — Automatic UPI Payment

This version uses Cashfree Payment Gateway for automatic UPI checkout and automatic key delivery.

## Payment flow
1. Customer selects a product/duration.
2. The site creates a Cashfree order from the server.
3. Customer is sent to Cashfree's secure UPI checkout.
4. Cashfree confirms the payment using the payment API/webhook.
5. The server verifies the webhook signature and/or reconciles payment status.
6. Only after a confirmed `SUCCESS` payment does the server remove one matching key from inventory and mark the order `paid`.
7. The customer sees the delivered key automatically.

The customer-facing checkout does **not** ask for name, phone/WhatsApp, or UTR.

## Render environment variables
Set these in Render → Environment:

- `CASHFREE_APP_ID` = your Cashfree Payment Gateway App ID
- `CASHFREE_SECRET_KEY` = your Cashfree Payment Gateway Secret Key
- `CASHFREE_ENV` = `production` for live payments, or `sandbox` for testing
- `PUBLIC_BASE_URL` = your public Render URL, for example `https://your-service.onrender.com`
- `CASHFREE_CUSTOMER_PHONE` = optional 10-digit server-side placeholder/contact value if your Cashfree account requires customer phone data; this is not collected from the customer
- `ADMIN_USER` = admin username
- `ADMIN_PASSWORD` = strong admin password
- `UPI_ID` = optional display UPI ID
- `PAYMENT_PAYEE_NAME` = optional display payee name

## Cashfree dashboard
Before live payments, create/activate your Payment Gateway account and API keys, whitelist the production website domain if Cashfree requests it, and configure the payment webhook URL:

`https://YOUR-DOMAIN/api/webhooks/cashfree`

Enable the payment success webhook. The server verifies the Cashfree webhook signature before releasing a key.

## Important
Do not put `CASHFREE_SECRET_KEY` in frontend JavaScript. It must remain a Render server environment variable.

For testing, use Cashfree sandbox credentials and `CASHFREE_ENV=sandbox`. Switch to production credentials only after the complete flow works.
