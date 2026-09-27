<?php
require __DIR__.'/config.php'; require_login();
$error=''; $message='';
if($_SERVER['REQUEST_METHOD']==='POST'){
    $plan=$_POST['plan']??'';
    if(!isset(KEY_PLANS[$plan])) $error='Invalid key plan.';
    else {
        $p=KEY_PLANS[$plan];
        try {
            $pdo->beginTransaction();
            $u=$pdo->prepare("SELECT id,username,balance FROM users WHERE id=?");
            $u->execute([$_SESSION['user_id']]); $user=$u->fetch();
            if(!$user || (float)$user['balance'] < $p['price']) {
                $pdo->rollBack(); $error='Insufficient wallet balance.';
            } else {
                $key=generate_user_key($user['username'],$pdo);
                $expires=(new DateTimeImmutable())->modify('+'.$p['seconds'].' seconds')->format('Y-m-d H:i:s');
                $ins=$pdo->prepare("INSERT INTO keys_table(license_key,owner_id,duration_label,duration_seconds,price,expires_at,status) VALUES(?,?,?,?,?,?,'active')");
                $ins->execute([$key,$user['id'],$p['label'],$p['seconds'],$p['price'],$expires]);
                $keyId=(int)$pdo->lastInsertId();
                $up=$pdo->prepare("UPDATE users SET balance=balance-? WHERE id=?");
                $up->execute([$p['price'],$user['id']]);
                $tx=$pdo->prepare("INSERT INTO transactions(user_id,type,amount,description,key_id) VALUES(?,'debit',?,?,?)");
                $tx->execute([$user['id'],$p['price'],'Purchased '.$p['label'].' key: '.$key,$keyId]);
                $pdo->commit();
                $message='Key generated: '.$key;
            }
        } catch(Throwable $e) {
            if($pdo->inTransaction()) $pdo->rollBack();
            $error='Could not generate key. Please try again.';
        }
    }
}
$q=$pdo->prepare("SELECT balance FROM users WHERE id=?"); $q->execute([$_SESSION['user_id']]); $balance=$q->fetchColumn();
$pageTitle='Generate Key'; require 'partials/header.php';
?>
<main class="container">
<section class="hero"><div class="eyebrow">KEY STORE</div><h1>GENERATE KEY</h1><p>Username-based random keys • Wallet deduction</p><div class="balance-pill">WALLET <strong>₹<?=number_format((float)$balance,2)?></strong></div></section>
<?php if($error): ?><div class="notice error" style="margin-top:18px"><?=htmlspecialchars($error)?></div><?php endif; ?>
<?php if($message): ?><div class="notice" style="margin-top:18px"><?=htmlspecialchars($message)?></div><?php endif; ?>
<section class="plans">
<?php foreach(KEY_PLANS as $id=>$p): ?>
<div class="plan"><div class="plan-title"><?=htmlspecialchars($p['label'])?></div><div class="price">₹<?=number_format($p['price'])?></div><div class="plan-note">Instant activation</div>
<form method="post"><input type="hidden" name="plan" value="<?=htmlspecialchars($id)?>"><button class="btn" type="submit">BUY & GENERATE</button></form></div>
<?php endforeach; ?>
</section>
</main>
<?php require 'partials/footer.php'; ?>
