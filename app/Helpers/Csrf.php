<?php
declare(strict_types=1);

namespace Reactor\Helpers;

final class Csrf
{
    public static function token(): string
    {
        if (empty($_SESSION['csrf_token'])) {
            $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        }

        return (string) $_SESSION['csrf_token'];
    }

    public static function verify(): void
    {
        $header = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
        $posted = $_POST['_csrf'] ?? '';
        $token = is_string($header) && $header !== '' ? $header : (string) $posted;

        if (!hash_equals(self::token(), $token)) {
            Response::error('Invalid CSRF token.', 419, 'csrf_failed');
        }
    }
}
