<?php
declare(strict_types=1);

// No external MySQL service is required. By default the app uses a local SQLite
// database created automatically on first request. If MYSQLHOST is provided later,
// the app can still use the existing MySQL setup.
$sessionLifetime = 2 * 24 * 60 * 60;
session_set_cookie_params([
    'lifetime' => $sessionLifetime,
    'path' => '/',
    'secure' => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'),
    'httponly' => true,
    'samesite' => 'Lax',
]);
session_start();

$useMySql = (bool)getenv('MYSQLHOST');

try {
    if ($useMySql) {
        $dbHost = (string)getenv('MYSQLHOST');
        $dbPort = (string)(getenv('MYSQLPORT') ?: '3306');
        $dbName = (string)(getenv('MYSQLDATABASE') ?: 'we_fear_none');
        $dbUser = (string)(getenv('MYSQLUSER') ?: 'root');
        $dbPass = (string)(getenv('MYSQLPASSWORD') ?: '');
        $pdo = new PDO("mysql:host=$dbHost;port=$dbPort;dbname=$dbName;charset=utf8mb4", $dbUser, $dbPass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    } else {
        $storageDir = __DIR__ . '/storage';
        if (!is_dir($storageDir) && !mkdir($storageDir, 0775, true) && !is_dir($storageDir)) {
            throw new RuntimeException('Unable to create database storage directory.');
        }
        $pdo = new PDO('sqlite:' . $storageDir . '/app.sqlite', null, null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
        $pdo->exec('PRAGMA foreign_keys = ON');

        // Create the schema automatically. This removes the need to create a
        // separate Railway MySQL service or manually import database.sql.
        $pdo->exec(<<<'SQL'
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    balance REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS keys_table (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    license_key TEXT NOT NULL UNIQUE,
    owner_id INTEGER NULL,
    duration_label TEXT NOT NULL,
    duration_seconds INTEGER NOT NULL,
    price REAL NOT NULL,
    expires_at TEXT NULL,
    status TEXT NOT NULL DEFAULT 'unused',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    description TEXT NOT NULL,
    key_id INTEGER NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (key_id) REFERENCES keys_table(id) ON DELETE SET NULL
);
SQL
        );
    }
} catch (Throwable $e) {
    http_response_code(500);
    exit('Database initialization failed. Please check the server configuration.');
}

const KEY_PLANS = [
    '5h'  => ['label'=>'5 Hours',  'seconds'=>5*3600,      'price'=>20],
    '12h' => ['label'=>'12 Hours', 'seconds'=>12*3600,     'price'=>40],
    '1d'  => ['label'=>'1 Day',    'seconds'=>1*86400,     'price'=>50],
    '3d'  => ['label'=>'3 Days',   'seconds'=>3*86400,     'price'=>150],
    '7d'  => ['label'=>'7 Days',   'seconds'=>7*86400,     'price'=>300],
    '15d' => ['label'=>'15 Days',  'seconds'=>15*86400,    'price'=>600],
    '30d' => ['label'=>'30 Days',  'seconds'=>30*86400,    'price'=>1000],
    '60d' => ['label'=>'60 Days',  'seconds'=>60*86400,    'price'=>1500],
];

function require_login(): void {
    if(empty($_SESSION['user_id'])) { header('Location: login.php'); exit; }
}
function require_admin(): void {
    require_login();
    if(($_SESSION['role']??'')!=='admin'){ http_response_code(403); exit('Admin access required.'); }
}
function generate_user_key(string $username, PDO $pdo): string {
    $clean=strtoupper(preg_replace('/[^A-Za-z0-9]/','',$username));
    $clean=substr($clean,0,16);
    do {
        $a=strtoupper(bin2hex(random_bytes(3)));
        $b=strtoupper(bin2hex(random_bytes(3)));
        $key=$clean.'-'.$a.'-'.$b;
        $q=$pdo->prepare("SELECT id FROM keys_table WHERE license_key=? LIMIT 1");
        $q->execute([$key]);
    } while($q->fetch());
    return $key;
}
