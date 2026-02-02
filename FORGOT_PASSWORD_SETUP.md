# 🔐 Forgot Password Feature - Quick Start

## ✅ Implemented Features

### 1. **Email Service** (`src/shared/services/email.service.ts`)

- ✅ Nodemailer integration
- ✅ Professional HTML email templates
- ✅ Password reset email with 1-hour expiry
- ✅ Welcome email (bonus)
- ✅ Email verification template (bonus)

### 2. **Password Reset Flow** (`src/modules/auth/services/auth.service.ts`)

- ✅ Secure token generation
- ✅ Redis storage with auto-expiry
- ✅ Email sending with error handling
- ✅ Token validation and password update
- ✅ Automatic session revocation (logs out all devices)
- ✅ User enumeration prevention (security)

### 3. **API Endpoints**

- ✅ `POST /api/v1/auth/forgot-password` - Request reset
- ✅ `POST /api/v1/auth/reset-password` - Complete reset

### 4. **Documentation**

- ✅ Email setup guide (`docs/EMAIL_SETUP.md`)
- ✅ Password reset flow guide (`docs/PASSWORD_RESET.md`)
- ✅ Updated Postman collection

## 🚀 Quick Setup (2 minutes)

### Step 1: Configure Email (Gmail Example)

1. **Get Gmail App Password:**
   - Go to: https://myaccount.google.com/apppasswords
   - Generate an app password (16 characters)

2. **Update `.env` file:**

```env
# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_16_char_app_password
EMAIL_FROM=noreply@sparkcollection.com
EMAIL_FROM_NAME=Spark Collection
FRONTEND_URL=http://localhost:3000
```

### Step 2: Test It!

```bash
# 1. Start server
npm run dev

# 2. Request password reset (using Postman or curl)
curl -X POST http://localhost:5000/api/v1/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email": "customer@test.com"}'

# 3. Check email inbox for reset link
# 4. Copy the token from the email URL

# 5. Reset password
curl -X POST http://localhost:5000/api/v1/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "YOUR_TOKEN_FROM_EMAIL",
    "password": "NewPassword@123"
  }'

# 6. Login with new password
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "customer@test.com",
    "password": "NewPassword@123"
  }'
```

## 📧 Email Preview

When a user requests a password reset, they receive:

```
Subject: Password Reset Request - Spark Collection

Hi [FirstName],

We received a request to reset your password for your
Spark Collection account.

Click the button below to reset your password:

[Reset Password Button]

Or copy this link:
http://localhost:3000/reset-password?token=abc123...

⏰ Important: This link will expire in 60 minutes.

If you didn't request a password reset, please ignore
this email or contact support if you have concerns.

Best regards,
Spark Collection Team
```

## 🔒 Security Features

1. **Token Expiry**: 1 hour (stored in Redis)
2. **One-time Use**: Token deleted after successful reset
3. **Session Revocation**: All devices logged out after reset
4. **User Enumeration Prevention**: Same response for valid/invalid emails
5. **Secure Token Generation**: Cryptographically secure random tokens
6. **Rate Limiting**: Prevents brute force attacks

## 📱 Frontend Integration Example

### React Component

```tsx
// ForgotPasswordPage.tsx
export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const res = await fetch("/api/v1/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    if (res.ok) {
      setSent(true);
    }
  };

  if (sent) {
    return (
      <div>
        <h2>Check Your Email</h2>
        <p>
          If an account exists for {email}, you'll receive a password reset link
          shortly.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2>Forgot Password</h2>
      <input
        type="email"
        placeholder="Enter your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <button type="submit">Send Reset Link</button>
    </form>
  );
}
```

```tsx
// ResetPasswordPage.tsx
export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const res = await fetch("/api/v1/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });

    if (res.ok) {
      alert("Password reset successful!");
      window.location.href = "/login";
    } else {
      alert("Invalid or expired token");
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>Reset Password</h2>
      <input
        type="password"
        placeholder="New Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <button type="submit">Reset Password</button>
    </form>
  );
}
```

## 🧪 Testing with Postman

The Postman collection is already updated! Just:

1. Import `postman.json`
2. Open "Forgot Password" request
3. Update email to a real email you can check
4. Send request
5. Check your email
6. Copy token from email
7. Open "Reset Password" request
8. Paste token and new password
9. Send request
10. Try logging in with new password

## 🐛 Troubleshooting

### Emails not arriving?

1. Check `.env` has correct SMTP settings
2. Look at server logs for errors
3. Check spam/junk folder
4. Verify Gmail App Password is correct
5. See `docs/EMAIL_SETUP.md` for detailed help

### "Invalid or expired reset token"?

- Token expires after 1 hour
- Token is one-time use
- Request a new reset link

### Still stuck?

- Check `docs/PASSWORD_RESET.md` for complete guide
- Review server logs in `./logs`
- Ensure Redis is running

## 📚 Documentation

- **Email Setup**: `docs/EMAIL_SETUP.md`
- **Password Reset Flow**: `docs/PASSWORD_RESET.md`
- **API Collection**: `postman.json`

## ✨ Next Steps

The implementation is complete and production-ready!

Optional enhancements:

- [ ] Add SMS verification option
- [ ] Implement password strength requirements
- [ ] Add password history (prevent reuse)
- [ ] Set up email queuing with Bull
- [ ] Monitor email delivery rates

## 🎉 You're All Set!

The forgot password feature is fully implemented with:

- ✅ Secure token generation and validation
- ✅ Beautiful HTML email templates
- ✅ Complete security measures
- ✅ Session management
- ✅ Full documentation

Just configure your email credentials and you're ready to go! 🚀
