<?php
declare(strict_types=1);

namespace Reactor\Helpers;

final class Response
{
    public static function json(array $payload, int $status = 200): never
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
        echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    public static function ok(array $data = [], int $status = 200): never
    {
        self::json(['ok' => true, 'data' => $data, 'csrf' => Csrf::token()], $status);
    }

    public static function error(string $message, int $status = 400, string $code = 'error', array $extra = []): never
    {
        self::json([
            'ok' => false,
            'error' => [
                'code' => $code,
                'message' => $message,
            ],
            'meta' => $extra,
            'csrf' => Csrf::token(),
        ], $status);
    }
}
