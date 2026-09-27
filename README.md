
# WE FEAR NONE — FULL LICENSE PANEL

This build includes the requested feature set:

- Easy Login & Register
- Single-device license binding for the APK
- User dashboard & profile
- Random key generation
- Custom key generation
- Change username
- Change password
- Reset all device bindings
- Reset a single key's device
- Delete all keys
- Delete single key
- Extend a single key
- Extend all keys
- Owner referral system
- Admin/reseller management structure
- Panel name change
- License type/name change
- Key price change
- Add/remove user balance
- Delete user
- Owner panel permissions
- Admin panel permissions
- Reseller panel permissions
- Persistent SQLite database
- APK license validation API
- Floating lightweight animation
- Mobile responsive interface

## Run locally / Railway

Node.js 18+ recommended.

    npm install
    npm start

Open http://localhost:3000

Default owner:
username: owner
password: owner123

Set:
JWT_SECRET=your-long-random-secret
OWNER_PASSWORD=your-owner-password

For Railway, attach a persistent volume and set DB_PATH to a path on that volume if you want database persistence across redeployments.

## APK license endpoint

POST /api/license/check

Body:
{
  "key": "WFN-...",
  "deviceId": "your-unique-device-id"
}

A valid license is automatically bound to the first device ID presented. A different device receives device_mismatch.

## Important production notes

The database is real SQLite, unlike the previous in-memory demo. For Railway, use a persistent volume. For Vercel, do NOT use this SQLite setup as the production database because serverless storage is not a persistent database. For Vercel, swap the database layer to PostgreSQL/Supabase/Neon.

Before public use:
- change default owner credentials
- set a strong JWT_SECRET
- use HTTPS
- add rate limiting
- keep APK/server secrets out of the APK
- add backups for the database
