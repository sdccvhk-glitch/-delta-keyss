# WE FEAR NONE — Vercel-ready panel

This package is prepared for Vercel's serverless environment.

## Vercel deployment
1. Upload/push the contents of this folder to GitHub.
2. Import that repository into Vercel.
3. Framework Preset: Other.
4. Build Command: leave empty.
5. Output Directory: leave empty.
6. Deploy.

The `api/index.js` serverless wrapper and `vercel.json` routing are included.

## Demo owner
Username: owner
Password: owner123

Set `JWT_SECRET` in Vercel Project Settings > Environment Variables before production.

## APK endpoint
POST `/api/license/check`

JSON:
{
  "key": "WFN-XXXX-XXXX",
  "deviceId": "unique-device-id"
}

## Important
This starter keeps users/licenses in memory for testing. Vercel serverless instances are not a permanent database. For a real production license server, connect the API to PostgreSQL/Supabase/another persistent database before relying on generated keys or balances.

Vercel's FUNCTION_INVOCATION_FAILED means the function crashed or otherwise failed during invocation; the Vercel logs contain the exact runtime error.
