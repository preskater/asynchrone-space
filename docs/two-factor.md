# Customer two-factor authentication

Customers turn on TOTP from **Account → Two-factor authentication**. The web app
registers Better Auth's `twoFactor` plugin with its own storage:

| | Customer (web) | Platform staff (control tower) |
|---|---|---|
| Secrets and backup codes | `customerTwoFactor` table | `twoFactor` table |
| Enabled flag | `user.customerTwoFactorEnabled` | `user.twoFactorEnabled` |
| Encryption key | `BETTER_AUTH_SECRET` | `CONTROL_TOWER_BETTER_AUTH_SECRET` |

The two must stay apart: each instance encrypts secrets with its own key
(ADR 0018), so a shared row would be unreadable on the other side and lock the
account out.

## Sign-in

1. The password is checked at `/sign-in`. When the account has 2FA, Better
   Auth drops the new session and sets a 10-minute pending cookie instead.
2. `/two-factor` asks for an authenticator code or a backup code. "Trust this
   device" skips the challenge on that browser for 30 days.

Only email/password sign-in is challenged. GitHub/GitLab sign-in relies on the
provider's own second factor.

Enabling and disabling write an `AuditLog` row (`member.two_factor_enabled` /
`member.two_factor_disabled`) in every organization the user belongs to.

## Lost device and backup codes (support)

A user who still has a backup code signs in with it, then sets 2FA up again.
Without one, support resets 2FA **after verifying the person's identity**
through a channel tied to the account (for example, the organization owner
confirming in writing). Then, against the database:

```sql
BEGIN;
DELETE FROM "customerTwoFactor" WHERE "userId" = '<user id>';
UPDATE "user" SET "customerTwoFactorEnabled" = false WHERE "id" = '<user id>';
DELETE FROM "session" WHERE "userId" = '<user id>';
COMMIT;
```

The user signs in with their password and should turn 2FA back on.
