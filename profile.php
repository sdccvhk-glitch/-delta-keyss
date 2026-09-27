<?php
require __DIR__.'/config.php'; require_login();
$error=''; $message='';
$q=$pdo->prepare("SELECT username,email,password_hash FROM users WHERE id=?"); $q->execute([$_SESSION['user_id']]); $user=$q->fetch();
if($_SERVER['REQUEST_METHOD']==='POST'){
 $action=$_POST['action']??'';
 if($action==='username'){
  $new=trim($_POST['username']??''); $current=$_POST['current_password']??'';
  if(!password_verify($current,$user['password_hash'])) $error='Current password is incorrect.';
  elseif(!preg_match('/^[A-Za-z0-9_]{3,32}$/',$new)) $error='Username must be 3–32 letters, numbers or underscores.';
  else { try{$s=$pdo->prepare("UPDATE users SET username=? WHERE id=?");$s->execute([$new,$_SESSION['user_id']]);$_SESSION['username']=$new;$user['username']=$new;$message='Username updated successfully.';}catch(PDOException $e){$error='That username is already in use.';} }
 }
 if($action==='password'){
  $current=$_POST['current_password']??'';$new=$_POST['new_password']??'';$confirm=$_POST['confirm_password']??'';
  if(!password_verify($current,$user['password_hash'])) $error='Current password is incorrect.';
  elseif(strlen($new)<6) $error='New password must be at least 6 characters.';
  elseif($new!==$confirm) $error='New passwords do not match.';
  elseif(password_verify($new,$user['password_hash'])) $error='New password must be different from the current password.';
  else {$s=$pdo->prepare("UPDATE users SET password_hash=? WHERE id=?");$s->execute([password_hash($new,PASSWORD_DEFAULT),$_SESSION['user_id']]);$message='Password changed successfully.';}
 }
}
$pageTitle='Account Settings'; require 'partials/header.php';
?>
<main class="container"><section class="hero"><div class="eyebrow">ACCOUNT CONTROL</div><h1>SETTINGS</h1><p>Manage your WE FEAR NONE account securely.</p></section>
<?php if($error): ?><div class="notice error" style="margin-top:18px"><?=htmlspecialchars($error)?></div><?php endif; ?>
<?php if($message): ?><div class="notice" style="margin-top:18px"><?=htmlspecialchars($message)?></div><?php endif; ?>
<div class="settings-grid">
<section class="panel"><div class="panel-head"><h2>Change Username</h2></div><form method="post"><input type="hidden" name="action" value="username"><div class="field"><label>NEW USERNAME</label><input name="username" value="<?=htmlspecialchars($user['username'])?>" maxlength="32" required></div><div class="field"><label>CURRENT PASSWORD</label><input type="password" name="current_password" required></div><button class="btn" type="submit">UPDATE USERNAME</button></form><div class="settings-note">New keys generated after the change will use your new username.</div></section>
<section class="panel"><div class="panel-head"><h2>Change Password</h2></div><form method="post"><input type="hidden" name="action" value="password"><div class="field"><label>CURRENT PASSWORD</label><input type="password" name="current_password" required></div><div class="field"><label>NEW PASSWORD</label><input type="password" name="new_password" minlength="6" required></div><div class="field"><label>CONFIRM NEW PASSWORD</label><input type="password" name="confirm_password" minlength="6" required></div><button class="btn" type="submit">CHANGE PASSWORD</button></form><div class="settings-note">Passwords are stored using PHP password hashing.</div></section>
</div><div class="actions" style="margin-top:18px"><a class="btn secondary" href="dashboard.php">← BACK TO DASHBOARD</a></div></main>
<?php require 'partials/footer.php'; ?>
