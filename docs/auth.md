# Auth and password reset

## Sign in

- **Mobile:** students, librarians, admins (role gates features)
- **Admin web:** admin role only (`GET /api/auth/me`)

## Forgot password

Uses Firebase Auth **email reset link** (`sendPasswordResetEmail`):

1. User enters account email
2. Firebase sends a link
3. User opens the link, sets a new password
4. User signs in again

Not using a custom OTP flow for the MVP. Dedicated OTP would need a separate email/SMS provider.

### Firebase Console checklist

1. Authentication -> Sign-in method -> Email/Password enabled
2. Authentication -> Templates -> Password reset (customize if you want)
3. Authorized domains include `localhost` for local testing

Mobile: Login -> Forgot password?  
Admin: `/forgot-password`
