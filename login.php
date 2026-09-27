<?php
require __DIR__.'/config.php';

if (!empty($_SESSION['user_id'])) {
    header('Location: dashboard.php');
    exit;
}

$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $identity = trim($_POST['identity'] ?? '');
    $password = $_POST['password'] ?? '';

    /*
     * Admin login
     * Username: admin
     * Password: admin123
     *
     * The admin account is created automatically if it doesn't exist.
     */
    if ($identity === 'admin' && $password === 'admin123') {

        $stmt = $pdo->prepare(
            "SELECT * FROM users WHERE username=? LIMIT 1"
        );
        $stmt->execute(['admin']);
        $user = $stmt->fetch();

        if (!$user) {
            $hash = password_hash('admin123', PASSWORD_DEFAULT);

            $stmt = $pdo->prepare(
                "INSERT INTO users
                (username, email, password_hash, role, balance)
                VALUES (?, ?, ?, ?, ?)"
            );

            $stmt->execute([
                'admin',
                'admin@wefearnone.local',
                $hash,
                'admin',
                0
            ]);

            $stmt = $pdo->prepare(
                "SELECT * FROM users WHERE username=? LIMIT 1"
            );
            $stmt->execute(['admin']);
            $user = $stmt->fetch();
        }

        /*
         * Make sure the account has admin privileges.
         */
        if ($user) {
            $pdo->prepare(
                "UPDATE users SET role='admin' WHERE id=?"
            )->execute([$user['id']]);

            session_regenerate_id(true);

            $_SESSION['user_id']  = $user['id'];
            $_SESSION['username'] = $user['username'];
            $_SESSION['role']     = 'admin';

            header('Location: admin.php');
            exit;
        }
    }

    /*
     * Normal user login
     */
    $stmt = $pdo->prepare(
        "SELECT * FROM users
         WHERE username=? OR email=?
         LIMIT 1"
    );

    $stmt->execute([$identity, $identity]);
    $user = $stmt->fetch();

    if ($user && password_verify($password, $user['password_hash'])) {

        session_regenerate_id(true);

        $_SESSION['user_id']  = $user['id'];
        $_SESSION['username'] = $user['username'];
        $_SESSION['role']     = $user['role'];

        header('Location: dashboard.php');
        exit;
    }

    $error = 'Invalid username/email or password.';
}

$pageTitle = 'Login';
require 'partials/header.php';
?>

<main class="auth">
    <div class="panel">

        <div class="eyebrow">WE FEAR NONE</div>

        <h1>LOGIN</h1>

        <p class="auth-sub">
            Enter your credentials to access the panel.
        </p>

        <?php if (isset($_GET['registered'])): ?>
            <div class="notice">
                Account created. You can login now.
            </div>
        <?php endif; ?>

        <?php if ($error): ?>
            <div class="notice error">
                <?= htmlspecialchars($error) ?>
            </div>
        <?php endif; ?>

        <form method="post">

            <div class="field">
                <label>USERNAME OR EMAIL</label>
                <input
                    name="identity"
                    required
                    autocomplete="username"
                >
            </div>

            <div class="field">
                <label>PASSWORD</label>
                <input
                    type="password"
                    name="password"
                    required
                    autocomplete="current-password"
                >
            </div>

            <button class="btn" type="submit">
                ENTER PANEL
            </button>

        </form>

        <div class="auth-link">
            New here?
            <a href="register.php">Create account</a>
        </div>

    </div>
</main>

<?php require 'partials/footer.php'; ?>
