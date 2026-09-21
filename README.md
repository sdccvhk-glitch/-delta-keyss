DELTA.KEYS License Panel

Features: Generate Key (game profile, device limit, license duration, batch quantity), Manage Keys (used/not used, expiry, block/unblock, reset devices), and API endpoint POST /api/login.

Set ADMIN_USER, ADMIN_PASSWORD, and API_SECRET on your host. The APK should call /api/login with Authorization: Bearer API_SECRET and JSON {game,user_key,serial}.

The uploaded APK's exact native endpoint/response handling still needs to be matched before a rebuilt APK can be truthfully claimed compatible.
