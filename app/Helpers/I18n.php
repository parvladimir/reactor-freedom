<?php
declare(strict_types=1);

namespace Reactor\Helpers;

final class I18n
{
    private const ALLOWED = ['ru', 'en', 'de'];

    public static function normalize(string $language): string
    {
        $language = strtolower(substr(trim($language), 0, 2));
        return in_array($language, self::ALLOWED, true) ? $language : 'en';
    }

    public static function load(string $language): array
    {
        $language = self::normalize($language);
        $fallback = self::read('en');
        $current = $language === 'en' ? [] : self::read($language);

        return self::merge($fallback, $current);
    }

    private static function read(string $language): array
    {
        $path = REACTOR_ROOT . '/lang/' . $language . '.json';
        if (!is_file($path)) {
            return [];
        }

        $decoded = json_decode((string) file_get_contents($path), true);
        return is_array($decoded) ? $decoded : [];
    }

    private static function merge(array $base, array $override): array
    {
        foreach ($override as $key => $value) {
            if (is_array($value) && isset($base[$key]) && is_array($base[$key])) {
                $base[$key] = self::merge($base[$key], $value);
            } else {
                $base[$key] = $value;
            }
        }

        return $base;
    }
}
