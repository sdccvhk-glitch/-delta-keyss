# DELTA.KEYS — Railway Theme Edition

Mobile-first dark/blue/purple theme inspired by the supplied reference screenshots.

## Features
- Select Access homepage with product + duration selectors
- Hamburger navigation
- UPI QR payment page using the supplied QR image
- Mandatory UTR / UPI transaction ID
- Admin login with username/email, password, and secret code
- Admin product/key/order dashboard
- Railway-ready Express server

## Railway environment variables
Set these in Railway Variables for production:
- ADMIN_USER=your admin username/email
- ADMIN_PASSWORD=your strong password
- ADMIN_SECRET=your strong secret code
- PAYMENT_UPI_ID=your UPI ID
- PAYMENT_PAYEE_NAME=DELTA.KEYS
- PAYMENT_NOTE=DELTA.KEYS order payment

The defaults in server.js are only for first-run testing and should be replaced.
