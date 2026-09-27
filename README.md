# WE FEAR NONE — License Panel

## Run
1. Install Node.js 18+.
2. In this folder run:
   npm install
3. Set a strong JWT_SECRET in production.
4. Run:
   npm start
5. Open http://localhost:3000

## Demo owner
Username: owner
Password: owner123

Change the default credentials and JWT secret before production.

## APK API
POST /api/license/check

Body:
{
  "key": "WFN-XXXX-XXXX",
  "deviceId": "unique-device-id"
}

A key is bound to its first supplied device ID. The endpoint returns valid=false for an invalid, expired, disabled, or mismatched-device license.

## Production notes
This starter keeps data in memory so it is easy to test. For production, replace the arrays with PostgreSQL/MySQL and use secure server-side secrets. Add rate limiting, HTTPS, audit logs, password reset, CSRF protection where applicable, and an admin-created role/permission system before opening the service publicly.
