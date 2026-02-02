# Email Configuration Guide

This guide explains how to set up email functionality for password reset, welcome emails, and email verification.

## Quick Setup for Gmail

### 1. Enable 2-Step Verification

1. Go to your Google Account settings: https://myaccount.google.com/
2. Navigate to **Security** → **2-Step Verification**
3. Follow the steps to enable it

### 2. Generate App Password

1. Go to: https://myaccount.google.com/apppasswords
2. Select **Mail** as the app
3. Select **Other (Custom name)** as the device
4. Enter "Spark Collection Backend" as the name
5. Click **Generate**
6. Copy the 16-character password (remove spaces)

### 3. Update .env File

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx  # App password from step 2
EMAIL_FROM=noreply@sparkcollection.com
EMAIL_FROM_NAME=Spark Collection
FRONTEND_URL=http://localhost:3000
```

## Other Email Providers

### SendGrid

```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your_sendgrid_api_key
EMAIL_FROM=verified_sender@yourdomain.com
EMAIL_FROM_NAME=Spark Collection
```

### AWS SES

```env
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_USER=your_aws_access_key_id
SMTP_PASS=your_aws_secret_access_key
EMAIL_FROM=verified_email@yourdomain.com
EMAIL_FROM_NAME=Spark Collection
```

### Mailgun

```env
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=postmaster@your-domain.mailgun.org
SMTP_PASS=your_mailgun_password
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME=Spark Collection
```

### Outlook/Office365

```env
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=your_email@outlook.com
SMTP_PASS=your_password
EMAIL_FROM=your_email@outlook.com
EMAIL_FROM_NAME=Spark Collection
```

## Testing Email Configuration

### 1. Start the Server

```bash
npm run dev
```

### 2. Test Forgot Password

Using Postman or curl:

```bash
curl -X POST http://localhost:5000/api/v1/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com"}'
```

### 3. Check Logs

The server logs will show:

- ✅ Success: "Password reset email sent to: user@example.com"
- ❌ Error: Detailed error message with SMTP issues

## Email Templates

The system includes pre-built HTML email templates for:

### 1. Password Reset Email

- **Trigger**: POST /api/v1/auth/forgot-password
- **Expiry**: 1 hour
- **Includes**: Reset link with token, security warnings

### 2. Welcome Email

- **Trigger**: User registration
- **Purpose**: Welcome new users, provide quick start guide

### 3. Email Verification

- **Trigger**: User registration (if email verification enabled)
- **Purpose**: Verify user email address

## Customizing Email Templates

Email templates are in: `src/shared/services/email.service.ts`

To customize:

1. Open the file
2. Find the method (e.g., `sendPasswordResetEmail`)
3. Modify the HTML template
4. Update styles, colors, and content as needed

## Troubleshooting

### Error: "Invalid login: 535-5.7.8 Username and Password not accepted"

- **Solution**: Use App Password instead of regular password for Gmail
- **Link**: https://support.google.com/accounts/answer/185833

### Error: "Connection timeout"

- **Check**: SMTP_HOST and SMTP_PORT are correct
- **Try**: Port 465 (SSL) instead of 587 (TLS)

### Error: "self signed certificate"

- **Development Only**: Add to email service config:
  ```typescript
  tls: {
    rejectUnauthorized: false;
  }
  ```
- **Production**: Fix SSL certificate issues

### Emails going to spam

- **Solutions**:
  - Use a verified domain email
  - Set up SPF and DKIM records
  - Use professional email service (SendGrid, Mailgun)
  - Avoid spam trigger words

### Rate Limiting

- **Gmail**: ~500 emails/day
- **SendGrid Free**: 100 emails/day
- **For production**: Use dedicated email service

## Security Best Practices

1. **Never commit .env file** - Already in .gitignore
2. **Use App Passwords** - Not your main password
3. **Rotate credentials** - Change passwords periodically
4. **Use HTTPS in production** - For password reset links
5. **Monitor email logs** - Check for suspicious activity

## Production Recommendations

For production environments:

1. **Use Professional Email Service**
   - SendGrid (Reliable, good free tier)
   - AWS SES (Cheap, scalable)
   - Mailgun (Developer-friendly)

2. **Set Up Domain Authentication**
   - SPF records
   - DKIM signing
   - DMARC policies

3. **Use Verified Domain**
   - noreply@yourdomain.com
   - Improves deliverability

4. **Enable Email Queuing**
   - Use Bull/Redis for email queue
   - Retry failed emails
   - Track delivery status

5. **Monitor Metrics**
   - Delivery rates
   - Bounce rates
   - Spam complaints

## Support

If you encounter issues:

1. Check the server logs in `./logs`
2. Verify .env configuration
3. Test SMTP connection independently
4. Review email service provider documentation
