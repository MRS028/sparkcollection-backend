# SSLCommerz Payment Integration

This document provides instructions for setting up and using SSLCommerz payment gateway in your e-commerce backend.

## Overview

SSLCommerz is a popular payment gateway in Bangladesh that supports multiple payment methods including:

- Credit/Debit Cards (Visa, MasterCard, AMEX)
- Mobile Banking (bKash, Nagad, Rocket)
- Internet Banking
- Wallet Payments

## Setup Instructions

### 1. Environment Variables

Add the following environment variables to your `.env` file:

```env
# SSLCommerz Configuration
SSLCOMMERZ_STORE_ID=your_store_id
SSLCOMMERZ_STORE_PASSWORD=your_store_password
SSLCOMMERZ_IS_LIVE=false  # Set to 'true' for production
SSLCOMMERZ_SUCCESS_URL=http://localhost:3000/payment/success
SSLCOMMERZ_FAIL_URL=http://localhost:3000/payment/fail
SSLCOMMERZ_CANCEL_URL=http://localhost:3000/payment/cancel
SSLCOMMERZ_IPN_URL=http://your-backend-url/api/v1/payments/sslcommerz/ipn
```

### 2. SSLCommerz Sandbox Credentials

For testing, get your sandbox credentials from:

- **Sandbox Panel**: https://sandbox.sslcommerz.com/

Default sandbox credentials:

- Store ID: `testbox`
- Store Password: `qwerty`

### 3. Production Setup

1. Register at https://www.sslcommerz.com/
2. Complete merchant verification
3. Get production credentials from SSLCommerz dashboard
4. Set `SSLCOMMERZ_IS_LIVE=true` in production

## API Endpoints

### Initialize Payment

```http
POST /api/v1/payments/sslcommerz/init
Authorization: Bearer <token>
Content-Type: application/json

{
  "orderId": "order_id_here",
  "customerPhone": "01712345678",
  "customerName": "John Doe",        // Optional
  "customerEmail": "john@example.com", // Optional
  "customerAddress": "Dhaka",        // Optional
  "customerCity": "Dhaka",           // Optional
  "customerPostcode": "1205",        // Optional
  "customerCountry": "Bangladesh",   // Optional
  "shippingMethod": "Courier",       // Optional: Courier, YES, NO
  "productName": "Order Items",      // Optional
  "productCategory": "General"       // Optional
}
```

**Response:**

```json
{
  "success": true,
  "message": "Payment session initialized",
  "data": {
    "gatewayUrl": "https://sandbox.sslcommerz.com/gwprocess/v4/gw.php?...",
    "sessionKey": "session_key_here",
    "transactionId": "TXN_ORD001_1234567890"
  }
}
```

### Callbacks (Called by SSLCommerz)

These endpoints are called by SSLCommerz servers after payment:

- **Success**: `POST /api/v1/payments/sslcommerz/success`
- **Fail**: `POST /api/v1/payments/sslcommerz/fail`
- **Cancel**: `POST /api/v1/payments/sslcommerz/cancel`
- **IPN**: `POST /api/v1/payments/sslcommerz/ipn`

### Get Payment Details

```http
GET /api/v1/payments/sslcommerz/:orderId
Authorization: Bearer <token>
```

### Validate Transaction

```http
GET /api/v1/payments/sslcommerz/validate/:valId
Authorization: Bearer <token>
```

### Get Transaction Details

```http
GET /api/v1/payments/sslcommerz/transaction/:transactionId
Authorization: Bearer <token>
```

### Process Refund (Admin Only)

```http
POST /api/v1/payments/sslcommerz/:orderId/refund
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "bankTransactionId": "bank_tran_id_from_sslcommerz",
  "amount": 500.00,      // Optional: for partial refund
  "reason": "Customer requested refund"  // Optional
}
```

## Payment Flow

### 1. Initialize Payment

```javascript
// Frontend code
const response = await fetch("/api/v1/payments/sslcommerz/init", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({
    orderId: "your_order_id",
    customerPhone: "01712345678",
  }),
});

const { data } = await response.json();

// Redirect user to SSLCommerz payment page
window.location.href = data.gatewayUrl;
```

### 2. Handle Callbacks

After payment, SSLCommerz redirects to your success/fail/cancel URLs:

```javascript
// Frontend: Success page (/payment/success)
// Query params: ?order_id=xxx&order_number=xxx

// Frontend: Fail page (/payment/fail)
// Query params: ?tran_id=xxx&status=xxx

// Frontend: Cancel page (/payment/cancel)
// Query params: ?tran_id=xxx
```

### 3. IPN (Instant Payment Notification)

SSLCommerz sends IPN to your backend for server-to-server confirmation. This is the most reliable way to verify payments.

**Important**: Your IPN URL must be publicly accessible. For local development, use:

- ngrok
- localtunnel
- Or any tunneling service

## Testing

### Test Cards (Sandbox)

| Card Type  | Card Number      | Expiry          | CVV          |
| ---------- | ---------------- | --------------- | ------------ |
| Visa       | 4111111111111111 | Any future date | Any 3 digits |
| MasterCard | 5500000000000004 | Any future date | Any 3 digits |

### Test Mobile Banking

In sandbox mode, use any valid phone number format (01XXXXXXXXX).

## Security Considerations

1. **IPN Verification**: Always verify IPN hash before processing
2. **Amount Verification**: Compare payment amount with order total
3. **Transaction ID Matching**: Verify transaction IDs match
4. **HTTPS**: Use HTTPS for all callback URLs in production
5. **Store Credentials**: Never expose store credentials in frontend

## Error Handling

Common error scenarios:

| Error         | Description     | Solution                    |
| ------------- | --------------- | --------------------------- |
| `FAILED`      | Payment failed  | Check card details, balance |
| `CANCELLED`   | User cancelled  | Redirect to checkout        |
| `EXPIRED`     | Session expired | Re-initialize payment       |
| Hash mismatch | Invalid IPN     | Check store password        |

## Mobile Banking Support

SSLCommerz supports popular mobile wallets:

- **bKash**: Most popular in Bangladesh
- **Nagad**: Growing rapidly
- **Rocket**: DBBL's mobile banking

Users select their preferred method on SSLCommerz page.

## Support

- **SSLCommerz Documentation**: https://developer.sslcommerz.com/doc/v4/
- **Sandbox**: https://sandbox.sslcommerz.com/
- **Support Email**: support@sslcommerz.com

## Troubleshooting

### Common Issues

1. **IPN not received**
   - Ensure IPN URL is publicly accessible
   - Check server logs for incoming requests
   - Verify SSL certificate in production

2. **Invalid Store ID**
   - Double-check credentials
   - Ensure using correct credentials for sandbox/production

3. **Amount mismatch**
   - Verify currency settings
   - Check for rounding issues

4. **Hash verification failed**
   - Verify store password
   - Check hash calculation order
