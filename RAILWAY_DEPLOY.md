# Railway deployment

This project is prepared for Railway with a PHP 8.3 Apache Docker image and PDO MySQL.

## 1. Create the Railway project
Create a new Railway project and add a **MySQL** service.

Railway exposes the MySQL connection variables `MYSQLHOST`, `MYSQLPORT`, `MYSQLUSER`, `MYSQLPASSWORD`, and `MYSQLDATABASE` to services in the same project.

## 2. Deploy the app
Push this folder to GitHub, then in Railway choose **Deploy from GitHub Repo** and select the repository.

Railway will use the included `Dockerfile` / `railway.json`.

## 3. Connect the app to MySQL
In the app service's Variables, add references to the MySQL service if Railway has not already made them available. The PHP app reads:

- `MYSQLHOST`
- `MYSQLPORT`
- `MYSQLDATABASE`
- `MYSQLUSER`
- `MYSQLPASSWORD`

No database password should be committed to GitHub.

## 4. Import the database
Use the Railway MySQL connection details to connect with a MySQL client and import `database.sql`.

If using the MySQL CLI, use the host, port, username, password, and database shown by the Railway MySQL service. Import the tables into the Railway-created database.

## 5. Generate the public URL
After deployment, open the app service in Railway and use **Settings → Networking → Generate Domain**.

## 6. First login
Open the generated URL and register the first account. This starter project makes the first registered account an admin.

## Important
For production, keep HTTPS enabled, use strong credentials, add CSRF protection/rate limiting, and do not expose MySQL publicly unless required.
