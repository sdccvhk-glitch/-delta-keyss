<?php
declare(strict_types=1);
session_start();

$dbHost='127.0.0.1'; $dbName='we_fear_none'; $dbUser='root'; $dbPass='';
try {
    $pdo=new PDO("mysql:host=$dbHost;dbname=$dbName;charset=utf8mb4",$dbUser,$dbPass,[
        PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES=>false
    ]);
} catch(PDOException $e) { http_response_code(500); exit('Database connection failed. Check config.php.'); }

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
