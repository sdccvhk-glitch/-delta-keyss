<?php
require __DIR__.'/config.php'; require_login();
$q=$pdo->prepare("SELECT * FROM users WHERE id=?"); $q->execute([$_SESSION['user_id']]); $user=$q->fetch();
$stmt=$pdo->prepare("SELECT * FROM keys_table WHERE owner_id=? ORDER BY id DESC"); $stmt->execute([$_SESSION['user_id']]); $keys=$stmt->fetchAll();
$active=0; foreach($keys as $k){ if($k['status']==='active' && strtotime($k['expires_at'])>time()) $active++; }
$tx=$pdo->prepare("SELECT * FROM transactions WHERE user_id=? ORDER BY id DESC LIMIT 10"); $tx->execute([$_SESSION['user_id']]); $transactions=$tx->fetchAll();
$pageTitle='Dashboard'; require 'partials/header.php';
?>
<main class="container">
<section class="hero"><div class="eyebrow">SECURE KEY SYSTEM</div><h1>WE FEAR NONE</h1><p>BGMI access control dashboard</p><div class="actions" style="justify-content:center"><a class="btn" href="activate.php">GENERATE KEY</a><a class="btn secondary" href="profile.php">SETTINGS</a><?php if($_SESSION['role']==='admin'): ?><a class="btn secondary" href="admin.php">ADMIN PANEL</a><?php endif; ?></div></section>
<section class="grid">
<div class="card"><h3>Wallet Balance</h3><div class="value cyan">₹<?=number_format((float)$user['balance'],2)?></div></div>
<div class="card"><h3>Active Keys</h3><div class="value"><?=$active?></div></div>
<div class="card"><h3>Account</h3><div class="value">@<?=htmlspecialchars($user['username'])?></div></div>
</section>
<section class="panel"><div class="panel-head"><h2>Your Keys</h2><a class="btn secondary" href="activate.php">+ Generate</a></div>
<div class="table-wrap"><table><tr><th>Key</th><th>Plan</th><th>Price</th><th>Status</th><th>Expires</th></tr>
<?php foreach($keys as $k): ?><tr><td><?=htmlspecialchars($k['license_key'])?></td><td><?=htmlspecialchars($k['duration_label'])?></td><td>₹<?=number_format((float)$k['price'])?></td><td><span class="badge"><?=htmlspecialchars(strtoupper($k['status']))?></span></td><td><?=htmlspecialchars($k['expires_at'])?></td></tr><?php endforeach; ?>
<?php if(!$keys): ?><tr><td colspan="5">No keys generated yet.</td></tr><?php endif; ?></table></div></section>
<section class="panel"><div class="panel-head"><h2>Wallet Transactions</h2></div>
<div class="table-wrap"><table><tr><th>Type</th><th>Amount</th><th>Description</th><th>Date</th></tr>
<?php foreach($transactions as $t): ?><tr><td><span class="badge"><?=strtoupper($t['type'])?></span></td><td>₹<?=number_format((float)$t['amount'],2)?></td><td><?=htmlspecialchars($t['description'])?></td><td><?=htmlspecialchars($t['created_at'])?></td></tr><?php endforeach; ?>
<?php if(!$transactions): ?><tr><td colspan="4">No transactions yet.</td></tr><?php endif; ?></table></div></section>
</main>
<?php require 'partials/footer.php'; ?>
