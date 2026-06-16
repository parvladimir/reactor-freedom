<?php
declare(strict_types=1);

use Reactor\Helpers\Csrf;
use Reactor\Helpers\Env;

define('REACTOR_ROOT', dirname(__DIR__, 2));

spl_autoload_register(static function (string $class): void {
    $prefix = 'Reactor\\';
    if (!str_starts_with($class, $prefix)) {
        return;
    }

    $relative = str_replace('\\', DIRECTORY_SEPARATOR, substr($class, strlen($prefix)));
    $path = REACTOR_ROOT . DIRECTORY_SEPARATOR . 'app' . DIRECTORY_SEPARATOR . $relative . '.php';

    if (is_file($path)) {
        require_once $path;
    }
});

Env::load(REACTOR_ROOT . '/.env');

$app = require REACTOR_ROOT . '/config/app.php';

if (PHP_SAPI !== 'cli' && session_status() !== PHP_SESSION_ACTIVE) {
    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
    $sessionPath = REACTOR_ROOT . '/storage/sessions';
    if (!is_dir($sessionPath)) {
        mkdir($sessionPath, 0775, true);
    }
    session_save_path($sessionPath);
    session_name((string) $app['session_name']);
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'domain' => '',
        'secure' => $secure,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

if (PHP_SAPI !== 'cli') {
    Csrf::token();
}

return $app;
