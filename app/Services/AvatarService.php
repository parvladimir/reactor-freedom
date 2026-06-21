<?php
declare(strict_types=1);

namespace Reactor\Services;

use InvalidArgumentException;
use RuntimeException;

final class AvatarService
{
    public const MAX_BYTES = 4 * 1024 * 1024;

    private const MIME_EXTENSIONS = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
    ];

    public function store(array $file, int $userId): array
    {
        $temporaryPath = (string) ($file['tmp_name'] ?? '');
        if ($temporaryPath === '' || !is_uploaded_file($temporaryPath)) {
            throw new InvalidArgumentException('Invalid uploaded file.');
        }

        $size = (int) ($file['size'] ?? 0);
        if ($size < 1 || $size > self::MAX_BYTES) {
            throw new InvalidArgumentException('Avatar file is too large.');
        }

        $finfo = new \finfo(FILEINFO_MIME_TYPE);
        $mime = (string) $finfo->file($temporaryPath);
        if (!isset(self::MIME_EXTENSIONS[$mime])) {
            throw new InvalidArgumentException('Unsupported avatar image type.');
        }

        $dimensions = @getimagesize($temporaryPath);
        if (!is_array($dimensions)) {
            throw new InvalidArgumentException('Avatar image is invalid.');
        }

        $width = (int) ($dimensions[0] ?? 0);
        $height = (int) ($dimensions[1] ?? 0);
        if ($width < 64 || $height < 64 || $width > 6000 || $height > 6000 || ($width * $height) > 25_000_000) {
            throw new InvalidArgumentException('Avatar image dimensions are invalid.');
        }

        $directory = $this->directory();
        if (!is_dir($directory) && !mkdir($directory, 0775, true) && !is_dir($directory)) {
            throw new RuntimeException('Avatar storage directory could not be created.');
        }

        $extension = self::MIME_EXTENSIONS[$mime];
        $filename = 'u' . $userId . '-' . bin2hex(random_bytes(12)) . '.' . $extension;
        $destination = $directory . DIRECTORY_SEPARATOR . $filename;
        $storedMime = $mime;

        if (!$this->resizeAndStore($temporaryPath, $destination, $mime)) {
            if (!move_uploaded_file($temporaryPath, $destination)) {
                throw new RuntimeException('Avatar image could not be stored.');
            }
        }

        @chmod($destination, 0644);

        return ['file' => $filename, 'mime' => $storedMime];
    }

    public function path(string $filename): ?string
    {
        if ($filename === '' || basename($filename) !== $filename || preg_match('/^[A-Za-z0-9._-]+$/', $filename) !== 1) {
            return null;
        }

        $path = $this->directory() . DIRECTORY_SEPARATOR . $filename;
        return is_file($path) ? $path : null;
    }

    public function delete(?string $filename): void
    {
        if (!is_string($filename) || $filename === '') {
            return;
        }

        $path = $this->path($filename);
        if ($path !== null) {
            @unlink($path);
        }
    }

    private function resizeAndStore(string $sourcePath, string $destination, string $mime): bool
    {
        if (!function_exists('imagecreatetruecolor')) {
            return false;
        }

        $loader = match ($mime) {
            'image/jpeg' => function_exists('imagecreatefromjpeg') ? 'imagecreatefromjpeg' : null,
            'image/png' => function_exists('imagecreatefrompng') ? 'imagecreatefrompng' : null,
            'image/webp' => function_exists('imagecreatefromwebp') ? 'imagecreatefromwebp' : null,
            default => null,
        };
        if ($loader === null) {
            return false;
        }

        $source = @$loader($sourcePath);
        if ($source === false) {
            throw new InvalidArgumentException('Avatar image could not be decoded.');
        }

        if ($mime === 'image/jpeg' && function_exists('exif_read_data')) {
            $exif = @exif_read_data($sourcePath);
            $orientation = is_array($exif) ? (int) ($exif['Orientation'] ?? 1) : 1;
            $rotated = match ($orientation) {
                3 => imagerotate($source, 180, 0),
                6 => imagerotate($source, -90, 0),
                8 => imagerotate($source, 90, 0),
                default => false,
            };
            if ($rotated !== false) {
                imagedestroy($source);
                $source = $rotated;
            }
        }

        $width = imagesx($source);
        $height = imagesy($source);
        $side = min($width, $height);
        $sourceX = (int) floor(($width - $side) / 2);
        $sourceY = (int) floor(($height - $side) / 2);
        $canvas = imagecreatetruecolor(512, 512);
        if ($canvas === false) {
            imagedestroy($source);
            throw new RuntimeException('Avatar image canvas could not be created.');
        }

        if ($mime !== 'image/jpeg') {
            imagealphablending($canvas, false);
            imagesavealpha($canvas, true);
            $transparent = imagecolorallocatealpha($canvas, 0, 0, 0, 127);
            imagefill($canvas, 0, 0, $transparent);
        }

        $copied = imagecopyresampled($canvas, $source, 0, 0, $sourceX, $sourceY, 512, 512, $side, $side);
        imagedestroy($source);
        if (!$copied) {
            imagedestroy($canvas);
            throw new RuntimeException('Avatar image could not be resized.');
        }

        $saved = match ($mime) {
            'image/jpeg' => imagejpeg($canvas, $destination, 88),
            'image/png' => imagepng($canvas, $destination, 7),
            'image/webp' => function_exists('imagewebp') && imagewebp($canvas, $destination, 88),
            default => false,
        };
        imagedestroy($canvas);

        return $saved;
    }

    private function directory(): string
    {
        return REACTOR_ROOT . DIRECTORY_SEPARATOR . 'storage' . DIRECTORY_SEPARATOR . 'avatars';
    }
}
