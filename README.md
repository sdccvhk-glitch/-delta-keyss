# DELTA.KEYS — Admin Approval Edition

Features:
- Modern dark/glass UI with floating animated background
- Separate Home, Products, Payment, Status/Key and Admin pages
- No Razorpay
- Customer selects a product, enters payment reference, then sees "Waiting for verification"
- Admin login
- Admin can approve/reject orders
- Admin can edit the customer's delivered key before approval
- Customer can copy the approved key
- Orders and keys are stored in `data/store.json`

## Railway variables

Set:
- ADMIN_USER=admin
- ADMIN_PASSWORD=your-own-password

No Razorpay variables are needed.

## Local run

npm install
npm start

## Payment QR configuration

Set these optional Railway/environment variables to show your real UPI QR details:
- `PAYMENT_UPI_ID=8590887093@fam`
- `PAYMENT_PAYEE_NAME=Your business name`
- `PAYMENT_NOTE=DELTA.KEYS order payment`

The payment page creates a UPI QR code for the selected product amount. Replace the fallback UPI ID before accepting real payments.
