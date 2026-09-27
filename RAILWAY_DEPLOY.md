# Railway deployment — no MySQL service required

This version runs on Railway with PHP 8.3 + Apache and uses a local SQLite database.
The database and its tables are created automatically on first request.

## GitHub / Railway

1. Replace the existing `Dockerfile`, `config.php`, `activate.php`, and `admin.php` with the files in this package.
2. Push the changes to GitHub.
3. Railway will rebuild the existing PHP service automatically.
4. You do **not** need to create a Railway MySQL service or add MySQL variables.
5. Open the Railway domain and create the first account. The first registered account becomes the admin.

## Important persistence note

SQLite removes the need for a separate database service, but Railway's normal container filesystem is not a permanent database store. The data will remain while the same deployment/container storage remains available, but a fresh deployment can reset the SQLite file. For permanent production data, a Railway volume or an external database is still recommended.
