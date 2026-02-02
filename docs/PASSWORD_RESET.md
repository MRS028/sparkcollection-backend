# Password Reset Flow

## Overview

The password reset feature allows users to securely reset their password via email.

## How It Works

### 1. Request Password Reset

**Endpoint**: `POST /api/v1/auth/forgot-password`

**Request:**

```json
{
  "email": "user@example.com"
}
```

**Response:**

```json
{
  "success": true,
  "message": "If the email exists, a password reset link will be sent"
}
```

**What Happens:**

1. System checks if email exists (doesn't reveal if user exists for security)
2. Generates a secure random token
3. Stores token in Redis with 1-hour expiry
4. Sends email with reset link to user
5. Always returns success message (prevents user enumeration)

### 2. User Receives Email

Email contains:

- Personalized greeting
- "Reset Password" button with embedded token
- Token link as plain text (for copy-paste)
- 1-hour expiry warning
- Security notice

Example reset URL:

```
http://localhost:3000/reset-password?token=abc123xyz...
```

### 3. Reset Password

**Endpoint**: `POST /api/v1/auth/reset-password`

**Request:**

```json
{
  "token": "abc123xyz...",
  "password": "newSecurePassword123"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Password reset successful"
}
```

**What Happens:**

1. Verifies token exists in Redis
2. Retrieves user ID from token
3. Updates user password (hashed with bcrypt)
4. Deletes reset token from Redis
5. Revokes all existing refresh tokens (logs out all devices)
6. Returns success

## Security Features

### 1. User Enumeration Prevention

- Always returns same success message
- Never reveals if email exists or not
- Prevents attackers from discovering valid emails

### 2. Token Security

- Cryptographically secure random tokens
- Stored in Redis (not database)
- Auto-expires after 1 hour
- One-time use (deleted after successful reset)

### 3. Session Management

- All existing sessions invalidated after password reset
- User must log in again with new password
- Prevents unauthorized access from old sessions

### 4. Rate Limiting

- Endpoint protected by global rate limiter
- Prevents brute force attacks
- Limits password reset attempts

## Frontend Integration

### Step 1: Forgot Password Page

```typescript
async function handleForgotPassword(email: string) {
  try {
    const response = await fetch(
      "http://localhost:5000/api/v1/auth/forgot-password",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      },
    );

    const data = await response.json();

    // Always show success message (don't reveal if user exists)
    showSuccessMessage(
      "If the email exists, a password reset link will be sent",
    );
  } catch (error) {
    showErrorMessage("Something went wrong. Please try again.");
  }
}
```

### Step 2: Reset Password Page

```typescript
async function handleResetPassword(token: string, password: string) {
  try {
    const response = await fetch(
      "http://localhost:5000/api/v1/auth/reset-password",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      },
    );

    if (response.ok) {
      showSuccessMessage("Password reset successful! Redirecting to login...");
      setTimeout(() => {
        window.location.href = "/login";
      }, 2000);
    } else {
      const error = await response.json();
      showErrorMessage(error.message || "Invalid or expired reset token");
    }
  } catch (error) {
    showErrorMessage("Something went wrong. Please try again.");
  }
}
```

### Example React Component

```tsx
import { useState } from "react";
import { useSearchParams } from "react-router-dom";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      alert("Password must be at least 8 characters");
      return;
    }

    try {
      const response = await fetch("/api/v1/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      if (response.ok) {
        alert("Password reset successful!");
        window.location.href = "/login";
      } else {
        const error = await response.json();
        alert(error.message);
      }
    } catch (error) {
      alert("An error occurred. Please try again.");
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h1>Reset Password</h1>
      <input
        type="password"
        placeholder="New Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <input
        type="password"
        placeholder="Confirm Password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        required
      />
      <button type="submit">Reset Password</button>
    </form>
  );
}
```

## Testing

### Using Postman

#### 1. Request Password Reset

```
POST http://localhost:5000/api/v1/auth/forgot-password
Content-Type: application/json

{
  "email": "test@example.com"
}
```

#### 2. Check Email Inbox

- Open the email client for test@example.com
- Find the password reset email
- Copy the token from the URL or email

#### 3. Reset Password

```
POST http://localhost:5000/api/v1/auth/reset-password
Content-Type: application/json

{
  "token": "token_from_email",
  "password": "NewPassword123!"
}
```

#### 4. Verify Password Changed

```
POST http://localhost:5000/api/v1/auth/login
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "NewPassword123!"
}
```

### Using cURL

```bash
# 1. Request reset
curl -X POST http://localhost:5000/api/v1/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'

# 2. Reset password (replace TOKEN with actual token from email)
curl -X POST http://localhost:5000/api/v1/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "TOKEN",
    "password": "NewPassword123!"
  }'
```

## Common Errors

### "Invalid or expired reset token"

- Token has expired (1 hour limit)
- Token was already used
- Token is invalid
- **Solution**: Request a new password reset

### "Email sending failed" (in logs)

- SMTP credentials incorrect
- Email service unavailable
- **Solution**: Check .env configuration and EMAIL_SETUP.md

### "Password too short"

- Password must be at least 8 characters
- **Solution**: Use stronger password

## Production Considerations

### 1. Token Expiry

Current: 1 hour (3600 seconds)

```typescript
// To change: src/modules/auth/services/auth.service.ts
await redis.set(`password_reset:${resetToken}`, user._id.toString(), 3600);
```

### 2. Email Template Customization

Edit `src/shared/services/email.service.ts`:

- Add company logo
- Update colors/branding
- Modify text content
- Add legal disclaimers

### 3. Monitoring

- Log all password reset requests
- Track failed reset attempts
- Monitor email delivery rates
- Alert on unusual patterns

### 4. Advanced Features (Future)

- [ ] Password strength requirements
- [ ] Password history (prevent reuse)
- [ ] Multi-factor authentication
- [ ] SMS verification option
- [ ] Security questions
- [ ] Account lockout after multiple failed attempts

## Troubleshooting

### Password reset emails not arriving

1. Check server logs for email sending errors
2. Verify SMTP configuration in .env
3. Check spam/junk folder
4. Test SMTP credentials independently
5. Review EMAIL_SETUP.md guide

### Token expired too quickly

- Increase expiry in auth.service.ts
- Current default: 1 hour (3600 seconds)

### All sessions not logging out after reset

- Verify `revokeAllUserTokens` is being called
- Check Redis connection
- Ensure refresh tokens are stored correctly

## API Reference

### POST /api/v1/auth/forgot-password

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| email | string | Yes | User email address |

**Response (200):**

```json
{
  "success": true,
  "message": "If the email exists, a password reset link will be sent"
}
```

### POST /api/v1/auth/reset-password

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| token | string | Yes | Reset token from email |
| password | string | Yes | New password (min 8 chars) |

**Response (200):**

```json
{
  "success": true,
  "message": "Password reset successful"
}
```

**Error Responses:**

- `400`: Invalid or expired reset token
- `404`: User not found
- `422`: Validation error (password too short)
