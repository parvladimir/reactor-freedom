<?php
declare(strict_types=1);

namespace Reactor\Services;

use Reactor\Helpers\I18n;

final class EmailService
{
    public function __construct(private readonly array $config)
    {
    }

    public function sendVerificationEmail(array $user, string $verificationUrl, string $language): bool
    {
        $messages = I18n::load($language);
        $appName = (string) ($this->config['name'] ?? 'REACTOR: Freedom');
        $subject = $this->translate($messages, 'email.verify_subject', ['app' => $appName]);
        $html = $this->verificationHtml($messages, $user, $verificationUrl, $appName);
        $plain = $this->translate($messages, 'email.verify_plain', [
            'name' => (string) ($user['name'] ?? ''),
            'app' => $appName,
            'url' => $verificationUrl,
        ]);

        $this->savePreview((string) ($user['email'] ?? 'unknown'), $subject, $html, $plain);

        $fromEmail = (string) ($this->config['mail']['from_email'] ?? 'noreply@example.com');
        $fromName = (string) ($this->config['mail']['from_name'] ?? $appName);
        $headers = [
            'MIME-Version: 1.0',
            'Content-Type: text/html; charset=UTF-8',
            'From: ' . $this->encodeHeader($fromName) . ' <' . $fromEmail . '>',
            'Reply-To: ' . $fromEmail,
            'X-Mailer: PHP/' . PHP_VERSION,
        ];

        return @mail(
            (string) $user['email'],
            $this->encodeHeader($subject),
            $html,
            implode("\r\n", $headers)
        );
    }

    private function verificationHtml(array $messages, array $user, string $verificationUrl, string $appName): string
    {
        $name = (string) ($user['name'] ?? '');
        $url = htmlspecialchars($verificationUrl, ENT_QUOTES, 'UTF-8');
        $preheader = htmlspecialchars($this->translate($messages, 'email.verify_preheader'), ENT_QUOTES, 'UTF-8');
        $kicker = htmlspecialchars($this->translate($messages, 'email.verify_kicker'), ENT_QUOTES, 'UTF-8');
        $title = htmlspecialchars($this->translate($messages, 'email.verify_title', ['name' => $name]), ENT_QUOTES, 'UTF-8');
        $body = htmlspecialchars($this->translate($messages, 'email.verify_body', ['app' => $appName]), ENT_QUOTES, 'UTF-8');
        $button = htmlspecialchars($this->translate($messages, 'email.verify_button'), ENT_QUOTES, 'UTF-8');
        $expiry = htmlspecialchars($this->translate($messages, 'email.verify_expiry'), ENT_QUOTES, 'UTF-8');
        $footer = htmlspecialchars($this->translate($messages, 'email.verify_footer'), ENT_QUOTES, 'UTF-8');

        return <<<HTML
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{$appName}</title>
</head>
<body style="margin:0;padding:0;background:#050813;color:#f4f8ff;font-family:Inter,Segoe UI,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;color:transparent;">{$preheader}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#050813;padding:28px 14px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;border:1px solid rgba(255,255,255,.14);border-radius:18px;background:linear-gradient(145deg,#151b2f,#071827);overflow:hidden;">
          <tr>
            <td style="padding:34px 30px 22px;text-align:center;">
              <div style="width:82px;height:82px;margin:0 auto 18px;border-radius:50%;background:radial-gradient(circle,#7bffcf 0 22%,#00d7ff 23% 46%,rgba(138,92,255,.18) 47% 100%);box-shadow:0 0 42px rgba(0,215,255,.35);"></div>
              <div style="color:#00d7ff;font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;">{$kicker}</div>
              <h1 style="margin:12px 0 10px;font-size:30px;line-height:1.15;color:#ffffff;">{$title}</h1>
              <p style="margin:0 auto;max-width:470px;color:#bac2d8;font-size:16px;line-height:1.6;">{$body}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 30px 34px;text-align:center;">
              <a href="{$url}" style="display:inline-block;padding:16px 26px;border-radius:12px;background:linear-gradient(135deg,#8a5cff,#00d7ff);color:#ffffff;text-decoration:none;font-weight:900;font-size:16px;box-shadow:0 18px 36px rgba(0,215,255,.24);">{$button}</a>
              <p style="margin:18px 0 0;color:#7bffcf;font-size:14px;font-weight:700;">{$expiry}</p>
              <p style="margin:18px auto 0;max-width:470px;color:#7f8aa8;font-size:12px;line-height:1.5;word-break:break-all;">{$url}</p>
            </td>
          </tr>
        </table>
        <p style="max-width:620px;margin:16px auto 0;color:#7f8aa8;font-size:12px;line-height:1.5;text-align:center;">{$footer}</p>
      </td>
    </tr>
  </table>
</body>
</html>
HTML;
    }

    private function translate(array $messages, string $path, array $vars = []): string
    {
        $value = array_reduce(
            explode('.', $path),
            static fn (mixed $carry, string $key): mixed => is_array($carry) && array_key_exists($key, $carry) ? $carry[$key] : null,
            $messages
        );
        $text = is_string($value) ? $value : $path;

        return preg_replace_callback('/\{(\w+)\}/', static fn (array $match): string => (string) ($vars[$match[1]] ?? ''), $text) ?? $text;
    }

    private function encodeHeader(string $value): string
    {
        return '=?UTF-8?B?' . base64_encode($value) . '?=';
    }

    private function savePreview(string $email, string $subject, string $html, string $plain): void
    {
        $dir = REACTOR_ROOT . '/storage/mail';
        if (!is_dir($dir)) {
            mkdir($dir, 0775, true);
        }

        $safeEmail = preg_replace('/[^a-z0-9._-]+/i', '_', $email) ?: 'mail';
        $file = $dir . '/' . date('Ymd_His') . '_' . $safeEmail . '.html';
        file_put_contents($file, "<!-- Subject: {$subject} -->\n<!-- Plain:\n{$plain}\n-->\n" . $html);
    }
}
