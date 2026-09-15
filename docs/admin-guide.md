# Administrator Guide

## Application profiles

An application profile represents one application. It contains the application ID, display name, audience, feature entitlements, installation limit, and license options.

Use **App profiles** to:

- Add an application profile.
- Edit the display name, installation limit, and feature entitlements.
- Add a license option.
- Remove a license option that has no active licenses.
- Delete an application profile that has no active licenses.

Profiles are persisted in `.data/portal.json`. Deleting a profile does not remove historical audit records.

## License options

License length belongs to the selected license option, not to the application itself.

Each option has:

- `id`: stable option identifier.
- `type`: normally `trial`, `pro`, or `base`.
- `label`: customer/operator-facing label.
- `length_days`: duration used when a license is issued.

Example:

```json
{
  "id": "trial-90-a1b2c3",
  "type": "trial",
  "label": "90-day trial",
  "length_days": 90
}
```

This allows one application to offer multiple trial lengths or Pro terms.

## Customers

Use **Customers** to create a customer before issuing a license. The customer dropdown in **Issue license** can select an existing customer or reveal the new-customer fields.

Customer email addresses are unique in the local store. A license issued for an existing email reuses the existing customer record.

A customer can be deleted only when no active license references it. Revoked-license history does not block deletion.

## Issue a license

1. Click **Issue license**.
2. Select an application profile.
3. Select an existing customer or choose **Add new customer**.
4. Select a configured license option.
5. Enter the human-readable instance value.
6. Paste the signed activation request exported by the application instance.
7. Submit the form.

The server verifies the instance proof before signing. The raw signed token is returned once by the issuance response. The portal persists the normalized activation request and the exact signed license claims used to create the token. It stores a SHA-256 token hash instead of the raw token.

## Renew and revoke

From **Licenses**:

- **Revoke** changes an active license to `revoked`, records the time, and creates an audit event.
- Revoked licenses remain visible as historical records.
- Revoked license tokens fail server-side verification.
- Renewal extends the license by its option duration and records a `license.renewed` audit event.
- **Deliver** reissues an active, unexpired token from the saved license claims when the original token was not saved. It keeps the same license ID and activation binding.

A revoked license cannot be renewed.

## Dashboard

The dashboard uses persisted state for:

- Active license count
- Trials in progress
- Renewal rate
- Licenses needing attention
- Recent activity
- Notification popover events
- Application profile summary

The dashboard counts only active, unexpired licenses for active metrics. Revoked records remain in historical counts such as the total Licenses navigation badge.

## Profile settings

The user row in the sidebar opens the administrator profile editor. The display name and email are stored in `.data/auth.json`; the dashboard greeting and sidebar avatar update from the saved display name.

Configuration also contains:

- Dark mode
- Color palettes: Meadow, Ocean, Clay, and Citrus
- Issuer status summary
