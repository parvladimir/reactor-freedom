<?php
declare(strict_types=1);

namespace Reactor\Helpers;

final class Input
{
    public static function json(): array
    {
        $raw = file_get_contents('php://input');
        if ($raw === false || trim($raw) === '') {
            return [];
        }

        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) {
            Response::error('Malformed JSON payload.', 400, 'invalid_json');
        }

        return $decoded;
    }

    public static function string(array $data, string $key, string $default = ''): string
    {
        $value = $data[$key] ?? $default;
        return is_string($value) ? trim($value) : $default;
    }

    public static function number(array $data, string $key, float $default = 0.0): float
    {
        $value = $data[$key] ?? $default;
        return is_numeric($value) ? (float) $value : $default;
    }

    public static function bool(array $data, string $key, bool $default = false): bool
    {
        $value = $data[$key] ?? $default;
        return filter_var($value, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) ?? $default;
    }

    public static function array(array $data, string $key): array
    {
        $value = $data[$key] ?? [];
        return is_array($value) ? $value : [];
    }
}
