<?php
require __DIR__.'/config.php';
if (!empty($_SESSION['user_id'])) { header('Location: dashboard.php'); exit; }
$error='';
if ($_SERVER['REQUEST_METHOD']==='POST') {
    $username=trim($_POST['username']??'');
    $email=trim($_POST['email']??'');
    $password=$_POST['password']??'';
    if (!preg_match('/^[A-Za-z0-9_]{3,32}$/',$username)) $error='Username must be 3–32 letters, numbers or underscores.';
    elseif (!filter_var($email,FILTER_VALIDATE_EMAIL)) $error='Enter a valid email.';
    elseif (strlen($password)<6) $error='Password must be at least 6 characters.';
    else {
        $count=(int)$pdo->query("SELECT COUNT(*) FROM users")->fetchColumn();
        try {
            $stmt=$pdo->prepare("INSERT INTO users(username,email,password_hash,role) VALUES(?,?,?,?)");
            $stmt->execute([$username,$email,password_hash($password,PASSWORD_DEFAULT),$count===0?'admin':'user']);
            header('Location: login.php?registered=1'); exit;
        } catch(PDOException $e) { $error='Username or email is already registered.'; }
    }
}
$pageTitle='Create Account'; require 'partials/header.php';
?>
<main class="auth">
<div class="panel">
  <div class="eyebrow">SECURE ACCESS</div>
  <h1>CREATE ACCOUNT</h1>
  <p class="auth-sub">Join the WE FEAR NONE key system.</p>
  <?php if($error): ?><div class="notice error"><?=htmlspecialchars($error)?></div><?php endif; ?>
  <form method="post">
    <div class="field"><label>USERNAME</label><input name="username" required maxlength="32"></div>
    <div class="field"><label>EMAIL</label><input type="email" name="email" required></div>
    <div class="field"><label>PASSWORD</label><input type="password" name="password" required minlength="6"></div>
    <button class="btn" type="submit">CREATE ACCOUNT</button>
  </form>
  <div class="auth-link">Already registered? <a href="login.php">Login</a></div>
</div>
</main>
<?php require 'partials/footer.php'; ?>
