<?php
declare(strict_types=1);

namespace Reactor\Middleware;

use Reactor\Helpers\Response;

final class AuthMiddleware
{
    public static function userId(): int
    {
        $userId = $_SESSION['user_id'] ?? null;

        if (!is_int($userId) && !(is_string($userId) && ctype_digit($userId))) {
            Response::error('Authentication required.', 401, 'unauthenticated');
        }

        return (int) $userId;
    }
}
