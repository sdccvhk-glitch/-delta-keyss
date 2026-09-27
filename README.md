# WE FEAR NONE — BGMI Key System

Black + cyan key-management web panel with accounts, wallet, priced keys and admin controls.

## Key pricing
- 5 Hours — ₹20
- 12 Hours — ₹40
- 1 Day — ₹50
- 3 Days — ₹150
- 7 Days — ₹300
- 15 Days — ₹600
- 30 Days — ₹1,000
- 60 Days — ₹1,500

## Key format
Keys are generated from the purchaser's username with a random unique suffix:
`USERNAME-XXXXXX-XXXXXX`

## Features
- Account registration/login/logout
- Password hashing
- User wallet balance
- Key purchase/generation with automatic balance deduction
- All 8 key plans
- Username-based random unique keys
- Key status and expiry
- Wallet transaction history
- Admin wallet credit/debit
- Admin key generation and revoke
- Responsive neon cyan/black UI

## Setup
1. Create a MySQL database by importing `database.sql`.
2. Edit MySQL credentials in `config.php`.
3. Put the folder under XAMPP `htdocs` or your PHP hosting public directory.
4. Open `register.php`.
5. The first registered account receives the admin role in this starter setup.

For production, use HTTPS, strong database credentials, CSRF protection, rate limiting, and a controlled admin provisioning process.
