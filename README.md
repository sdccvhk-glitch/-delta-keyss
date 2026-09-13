# DELTA.KEYS — Manual UPI + Admin Approval

This version removes Razorpay completely and uses manual UPI payment.

## Payment flow

1. Customer selects a product and duration.
2. The checkout page displays the DELTA.KEYS UPI QR code and UPI ID.
3. Customer pays the exact amount.
4. Customer enters their name, phone/WhatsApp number and UPI transaction ID/UTR.
5. The site creates an order with status `pending`.
6. The customer receives an Order ID and can use **Check Order**.
7. Admin opens **Admin → Customers & Orders**, checks the payment in the UPI app/bank, and changes the order to **paid**.
8. On approval, the server allocates one matching inventory key and the key becomes visible to the customer.
9. If the payment is not valid, admin can mark the order `rejected`; no key is released.

## Render environment variables

Required:
- `ADMIN_USER`
- `ADMIN_PASSWORD`
- `PAYMENT_PAYEE_NAME` (optional)
- `UPI_ID` (recommended; example: yourname@upi)

No Razorpay variables are required.

## Important

Set `UPI_ID` to your own UPI ID and replace `public/upi-qr.jpg` with a QR code that belongs to that UPI account. Never publish private banking credentials.

