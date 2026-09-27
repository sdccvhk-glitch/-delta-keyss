# DELTA.KEYS License Server

Deploy this folder to Railway/Render/etc.

Environment variables:
- ADMIN_TOKEN: long random secret
- PORT: normally supplied by the host
- DB_PATH: optional, defaults to licenses.db

Verify: POST /api/license/verify
JSON: {"license":"DELTA-...","device_id":"device-id"}

Create: POST /api/admin/create with x-admin-token and {"days":30}
Revoke: POST /api/admin/revoke with x-admin-token and {"license":"DELTA-..."}
Unbind: POST /api/admin/unbind with x-admin-token and {"license":"DELTA-..."}
