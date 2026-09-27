<?php
require __DIR__.'/config.php'; require_admin();
$message=''; $error='';
if($_SERVER['REQUEST_METHOD']==='POST'){
    try {
        if(isset($_POST['generate'])){
            $plan=$_POST['plan']??'';
            if(!isset(KEY_PLANS[$plan])) throw new Exception('Invalid plan.');
            $p=KEY_PLANS[$plan];
            $owner=(int)($_POST['owner_id']??0);
            $u=$pdo->prepare("SELECT id,username FROM users WHERE id=?"); $u->execute([$owner]); $ownerUser=$u->fetch();
            if(!$ownerUser) throw new Exception('User not found.');
            $key=generate_user_key($ownerUser['username'],$pdo);
            $expires=(new DateTimeImmutable())->modify('+'.$p['seconds'].' seconds')->format('Y-m-d H:i:s');
            $stmt=$pdo->prepare("INSERT INTO keys_table(license_key,owner_id,duration_label,duration_seconds,price,expires_at,status) VALUES(?,?,?,?,?,?,'active')");
            $stmt->execute([$key,$ownerUser['id'],$p['label'],$p['seconds'],0,$expires]);
            $message='Admin generated key: '.$key;
        } elseif(isset($_POST['balance_action'])){
            $uid=(int)$_POST['user_id']; $amount=(float)$_POST['amount']; $type=$_POST['balance_action'];
            if($amount<=0) throw new Exception('Amount must be positive.');
            $pdo->beginTransaction();
            $q=$pdo->prepare("SELECT id,username,balance FROM users WHERE id=? FOR UPDATE"); $q->execute([$uid]); $u=$q->fetch();
            if(!$u) throw new Exception('User not found.');
            if($type==='debit' && (float)$u['balance']<$amount) throw new Exception('User has insufficient balance.');
            $delta=$type==='credit' ? $amount : -$amount;
            $pdo->prepare("UPDATE users SET balance=balance+? WHERE id=?")->execute([$delta,$uid]);
            $desc=ucfirst($type).' by admin';
            $pdo->prepare("INSERT INTO transactions(user_id,type,amount,description) VALUES(?,?,?,?)")->execute([$uid,$type,$amount,$desc]);
            $pdo->commit(); $message='Balance updated for @'.$u['username'].'.';
        } elseif(isset($_POST['revoke'])){
            $pdo->prepare("UPDATE keys_table SET status='revoked' WHERE id=?")->execute([(int)$_POST['id']]);
            $message='Key revoked.';
        }
    } catch(Throwable $e) {
        if($pdo->inTransaction()) $pdo->rollBack();
        $error=$e->getMessage();
    }
}
$usersRows=$pdo->query("SELECT id,username,email,balance,role,created_at FROM users ORDER BY id DESC")->fetchAll();
$keys=$pdo->query("SELECT k.*,u.username FROM keys_table k LEFT JOIN users u ON u.id=k.owner_id ORDER BY k.id DESC")->fetchAll();
$pageTitle='Admin Panel'; require 'partials/header.php';
?>
<main class="container">
<section class="hero"><div class="eyebrow">CONTROL CENTER</div><h1>ADMIN PANEL</h1><p>Keys • Wallets • Accounts</p></section>
<?php if($message): ?><div class="notice" style="margin-top:18px"><?=htmlspecialchars($message)?></div><?php endif; ?>
<?php if($error): ?><div class="notice error" style="margin-top:18px"><?=htmlspecialchars($error)?></div><?php endif; ?>

<section class="panel"><div class="panel-head"><h2>Generate Key For User</h2></div>
<form method="post" class="admin-form"><select name="owner_id" required><option value="">Select user</option><?php foreach($usersRows as $u): ?><option value="<?=$u['id']?>"><?=htmlspecialchars($u['username'])?></option><?php endforeach; ?></select>
<select name="plan" required><?php foreach(KEY_PLANS as $id=>$p): ?><option value="<?=$id?>"><?=htmlspecialchars($p['label'])?> — ₹<?=number_format($p['price'])?></option><?php endforeach; ?></select><button class="btn" name="generate">GENERATE</button></form></section>

<section class="panel"><div class="panel-head"><h2>Wallet Management</h2></div>
<div class="table-wrap"><table><tr><th>User</th><th>Balance</th><th>Action</th></tr>
<?php foreach($usersRows as $u): ?><tr><td>@<?=htmlspecialchars($u['username'])?></td><td>₹<?=number_format((float)$u['balance'],2)?></td><td><form method="post" class="inline-form"><input type="hidden" name="user_id" value="<?=$u['id']?>"><input name="amount" type="number" step="0.01" min="0.01" placeholder="Amount" required><button class="btn" name="balance_action" value="credit">CREDIT</button><button class="btn secondary" name="balance_action" value="debit">DEBIT</button></form></td></tr><?php endforeach; ?></table></div></section>

<section class="panel"><div class="panel-head"><h2>Key Inventory</h2></div>
<div class="table-wrap"><table><tr><th>Key</th><th>Owner</th><th>Plan</th><th>Status</th><th>Expires</th><th></th></tr>
<?php foreach($keys as $k): ?><tr><td><?=htmlspecialchars($k['license_key'])?></td><td><?=htmlspecialchars($k['username']??'—')?></td><td><?=htmlspecialchars($k['duration_label'])?></td><td><span class="badge"><?=strtoupper(htmlspecialchars($k['status']))?></span></td><td><?=htmlspecialchars($k['expires_at']??'—')?></td><td><?php if($k['status']!=='revoked'): ?><form method="post"><input type="hidden" name="id" value="<?=$k['id']?>"><button class="btn secondary" name="revoke">REVOKE</button></form><?php endif; ?></td></tr><?php endforeach; ?></table></div></section>
</main>
<?php require 'partials/footer.php'; ?>
