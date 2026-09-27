<?php
$pageTitle = $pageTitle ?? 'WE FEAR NONE';
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title><?= htmlspecialchars($pageTitle) ?> — WE FEAR NONE</title>
<link rel="stylesheet" href="assets/style.css">
</head>
<body>
<div class="bg-grid"></div>
<header class="topbar">
  <a class="brand" href="dashboard.php"><span class="brand-mark">◆</span> WE FEAR NONE</a>
  <?php if (!empty($_SESSION['user_id'])): ?>
  <div class="top-user">
    <span class="status-dot"></span><?= htmlspecialchars($_SESSION['username']) ?>
    <a href="profile.php">Settings</a><a href="logout.php">Logout</a>
  </div>
  <?php endif; ?>
</header>
  
