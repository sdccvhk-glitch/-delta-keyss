# DELTA.KEYS — Manual UPI Payment Protection

This version uses a two-step manual UPI flow:

1. Customer selects a product and starts the UPI payment.
2. The server creates an `awaiting_payment` order and gives the customer a UPI intent link.
3. Only after that order exists can the customer submit a UTR.
4. The order becomes `pending` and the admin must verify the actual payment in the receiving UPI/bank account.
5. Only admin approval releases an inventory key.

## Important limitation
Manual UPI by itself cannot prove that a customer actually paid. A customer can still open a UPI app and abandon the payment, then type a fake UTR. This version prevents direct UTR submission without first starting an order/payment flow, but **real automatic verification requires a payment provider or a bank/UPI transaction verification API**.

Do not approve an order based only on the UTR text. Verify the amount, UTR and payer in the receiving account before clicking Approve.
