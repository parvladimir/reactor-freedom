<?php
declare(strict_types=1);

namespace Reactor\Services;

use Reactor\Helpers\I18n;
use RuntimeException;

final class EmailService
{
    public function __construct(private readonly array $config)
    {
    }

    public function sendVerificationEmail(array $user, string $verificationUrl, string $language): bool
    {
        $messages = I18n::load($language);
        $appName = (string) ($this->config['name'] ?? 'REACTOR: Freedom');
        $subject = 'Confirm your REACTOR account';
        $html = $this->verificationHtml($messages, $user, $verificationUrl, $appName);
        $plain = $this->translate($messages, 'email.verify_plain', [
            'name' => (string) ($user['name'] ?? ''),
            'app' => $appName,
            'url' => $verificationUrl,
        ]);

        $this->savePreview((string) ($user['email'] ?? 'unknown'), $subject, $html, $plain);

        $fromEmail = (string) ($this->config['mail']['from_email'] ?? 'noreply@example.com');
        $fromName = (string) ($this->config['mail']['from_name'] ?? $appName);
        $toEmail = (string) $user['email'];
        $message = $this->mimeMessage($fromName, $fromEmail, $toEmail, $subject, $html, $plain);
        $fallbackMessage = $this->plainMessage($fromName, $fromEmail, $toEmail, $subject, $plain);
        $minimalMessage = $this->minimalMessage($fromEmail, $toEmail, $verificationUrl);

        if ($this->brevoEnabled()) {
            return $this->sendViaBrevo($fromName, $fromEmail, $user, $subject, $html, $plain);
        }

        if ($this->smtpEnabled()) {
            return $this->sendViaSmtp($fromEmail, $toEmail, $message, $fallbackMessage, $minimalMessage);
        }

        $headers = [
            'MIME-Version: 1.0',
            'Content-Type: text/html; charset=UTF-8',
            'From: ' . $this->encodeHeader($fromName) . ' <' . $fromEmail . '>',
            'Reply-To: ' . $fromEmail,
            'X-Mailer: PHP/' . PHP_VERSION,
        ];

        return @mail(
            $toEmail,
            $this->encodeHeader($subject),
            $html,
            implode("\r\n", $headers)
        );
    }

    private function verificationHtml(array $messages, array $user, string $verificationUrl, string $appName): string
    {
        $name = (string) ($user['name'] ?? '');
        $url = htmlspecialchars($verificationUrl, ENT_QUOTES, 'UTF-8');
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
<body style="margin:0;padding:0;background:#f3f6fb;color:#142033;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f6fb;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;border:1px solid #dbe4f0;background:#ffffff;">
          <tr>
            <td style="padding:28px 28px 18px;text-align:left;">
              <div style="color:#0875c9;font-size:12px;font-weight:bold;text-transform:uppercase;">{$kicker}</div>
              <h1 style="margin:10px 0 12px;font-size:26px;line-height:1.25;color:#142033;">{$title}</h1>
              <p style="margin:0;color:#4c5a70;font-size:16px;line-height:1.6;">{$body}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 30px;text-align:left;">
              <p style="margin:0 0 20px;">
                <a href="{$url}" style="display:inline-block;padding:14px 20px;background:#0875c9;color:#ffffff;text-decoration:none;font-weight:bold;font-size:16px;">{$button}</a>
              </p>
              <p style="margin:0 0 12px;color:#0875c9;font-size:14px;font-weight:bold;">{$expiry}</p>
              <p style="margin:0;color:#6b778c;font-size:12px;line-height:1.5;word-break:break-all;">{$url}</p>
            </td>
          </tr>
        </table>
        <p style="max-width:600px;margin:16px auto 0;color:#6b778c;font-size:12px;line-height:1.5;text-align:center;">{$footer}</p>
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
        $value = $this->cleanHeader($value);

        if (preg_match("/^[A-Za-z0-9 !#$%&'*+\\-\\/=?^_`{|}~.]+$/", $value) === 1) {
            return $value;
        }

        if (function_exists('iconv_mime_encode')) {
            $encoded = iconv_mime_encode('X', $value, [
                'scheme' => 'B',
                'input-charset' => 'UTF-8',
                'output-charset' => 'UTF-8',
                'line-length' => 76,
                'line-break-chars' => "\r\n",
            ]);

            if (is_string($encoded) && str_starts_with($encoded, 'X: ')) {
                return substr($encoded, 3);
            }
        }

        $chunks = str_split(base64_encode($value), 48);
        $encoded = array_map(static fn (string $chunk): string => '=?UTF-8?B?' . $chunk . '?=', $chunks);

        return implode("\r\n ", $encoded);
    }

    private function mimeMessage(string $fromName, string $fromEmail, string $toEmail, string $subject, string $html, string $plain): string
    {
        $boundary = 'reactor_' . bin2hex(random_bytes(12));
        $headers = $this->messageHeaders($fromName, $fromEmail, $toEmail, $subject);
        $headers[] = 'Content-Type: multipart/alternative; boundary="' . $boundary . '"';

        return implode("\r\n", $headers)
            . "\r\n\r\n"
            . "--{$boundary}\r\n"
            . "Content-Type: text/plain; charset=UTF-8\r\n"
            . "Content-Transfer-Encoding: base64\r\n\r\n"
            . $this->base64Body($plain) . "\r\n"
            . "--{$boundary}\r\n"
            . "Content-Type: text/html; charset=UTF-8\r\n"
            . "Content-Transfer-Encoding: base64\r\n\r\n"
            . $this->base64Body($html) . "\r\n"
            . "--{$boundary}--\r\n";
    }

    private function plainMessage(string $fromName, string $fromEmail, string $toEmail, string $subject, string $plain): string
    {
        $headers = $this->messageHeaders($fromName, $fromEmail, $toEmail, $subject);
        $headers[] = 'Content-Type: text/plain; charset=UTF-8';
        $headers[] = 'Content-Transfer-Encoding: base64';

        return implode("\r\n", $headers)
            . "\r\n\r\n"
            . $this->base64Body($plain) . "\r\n";
    }

    private function minimalMessage(string $fromEmail, string $toEmail, string $verificationUrl): string
    {
        $body = "Hello,\r\n\r\n"
            . "Please confirm your REACTOR account:\r\n"
            . $verificationUrl . "\r\n\r\n"
            . "This link is valid for 24 hours.\r\n";

        $headers = [
            'Date: ' . date(DATE_RFC2822),
            'From: ' . $this->cleanAddress($fromEmail),
            'To: ' . $this->cleanAddress($toEmail),
            'Subject: Confirm your REACTOR account',
            'Message-ID: ' . $this->messageId($fromEmail),
            'MIME-Version: 1.0',
            'Content-Type: text/plain; charset=us-ascii',
            'Content-Transfer-Encoding: 7bit',
        ];

        return implode("\r\n", $headers) . "\r\n\r\n" . $body;
    }

    /**
     * @return array<int, string>
     */
    private function messageHeaders(string $fromName, string $fromEmail, string $toEmail, string $subject): array
    {
        return [
            'Date: ' . date(DATE_RFC2822),
            'From: ' . $this->cleanAddress($fromEmail),
            'To: ' . $this->cleanAddress($toEmail),
            'Subject: ' . $this->encodeHeader($subject),
            'Message-ID: ' . $this->messageId($fromEmail),
            'MIME-Version: 1.0',
        ];
    }

    private function smtpEnabled(): bool
    {
        $mail = $this->config['mail'] ?? [];

        return (string) ($mail['smtp_host'] ?? '') !== ''
            && (string) ($mail['smtp_user'] ?? '') !== ''
            && (string) ($mail['smtp_pass'] ?? '') !== '';
    }

    private function brevoEnabled(): bool
    {
        $mail = $this->config['mail'] ?? [];

        return (string) ($mail['provider'] ?? '') === 'brevo'
            && (string) ($mail['brevo_api_key'] ?? '') !== '';
    }

    private function sendViaBrevo(string $fromName, string $fromEmail, array $user, string $subject, string $html, string $plain): bool
    {
        $mail = $this->config['mail'] ?? [];
        $apiKey = (string) ($mail['brevo_api_key'] ?? '');
        $payload = [
            'sender' => [
                'email' => $fromEmail,
                'name' => $fromName,
            ],
            'to' => [[
                'email' => (string) ($user['email'] ?? ''),
                'name' => (string) ($user['name'] ?? ''),
            ]],
            'subject' => $subject,
            'htmlContent' => $html,
            'textContent' => $plain,
        ];

        $response = '';
        $statusCode = 0;

        try {
            $body = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            if (!is_string($body)) {
                throw new RuntimeException('Brevo payload JSON encoding failed.');
            }

            if (function_exists('curl_init')) {
                $curl = curl_init('https://api.brevo.com/v3/smtp/email');
                if ($curl === false) {
                    throw new RuntimeException('Brevo cURL initialization failed.');
                }

                curl_setopt_array($curl, [
                    CURLOPT_POST => true,
                    CURLOPT_POSTFIELDS => $body,
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_HEADER => false,
                    CURLOPT_TIMEOUT => 20,
                    CURLOPT_HTTPHEADER => [
                        'accept: application/json',
                        'api-key: ' . $apiKey,
                        'content-type: application/json',
                    ],
                ]);

                $result = curl_exec($curl);
                $statusCode = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
                if ($result === false) {
                    $error = curl_error($curl);
                    curl_close($curl);
                    throw new RuntimeException('Brevo cURL error: ' . $error);
                }
                curl_close($curl);
                $response = (string) $result;
            } else {
                $context = stream_context_create([
                    'http' => [
                        'method' => 'POST',
                        'header' => implode("\r\n", [
                            'accept: application/json',
                            'api-key: ' . $apiKey,
                            'content-type: application/json',
                        ]),
                        'content' => $body,
                        'ignore_errors' => true,
                        'timeout' => 20,
                    ],
                ]);

                $result = file_get_contents('https://api.brevo.com/v3/smtp/email', false, $context);
                $response = is_string($result) ? $result : '';
                $statusLine = $http_response_header[0] ?? '';
                if (preg_match('/\s(\d{3})\s/', (string) $statusLine, $match) === 1) {
                    $statusCode = (int) $match[1];
                }
            }

            if ($statusCode >= 200 && $statusCode < 300) {
                $this->logMailInfo(
                    'Brevo accepted email HTTP ' . $statusCode
                    . ': ' . $this->shortLog($response)
                    . ' | Brevo context: from=' . $fromEmail
                    . '; to=' . (string) ($user['email'] ?? '')
                );
                return true;
            }

            throw new RuntimeException('Brevo API unexpected response HTTP ' . $statusCode . ': ' . $this->shortLog($response));
        } catch (RuntimeException $exception) {
            $this->logMailError($exception->getMessage() . ' | Brevo context: from=' . $fromEmail . '; to=' . (string) ($user['email'] ?? ''));
            return false;
        }
    }

    private function sendViaSmtp(string $fromEmail, string $toEmail, string $message, ?string $fallbackMessage = null, ?string $minimalMessage = null): bool
    {
        $mail = $this->config['mail'] ?? [];
        $error = '';

        if ($this->trySendViaSmtp($mail, $fromEmail, $toEmail, $message, $error)) {
            return true;
        }

        if ($fallbackMessage !== null && str_contains($error, 'during DATA body')) {
            $this->logMailError('SMTP primary message failed, retrying text fallback: ' . $error . ' | ' . $this->smtpDebugContext($mail, $fromEmail));
            $fallbackError = '';
            if ($this->trySendViaSmtp($mail, $fromEmail, $toEmail, $fallbackMessage, $fallbackError)) {
                return true;
            }
            $error = $fallbackError;
        }

        if ($minimalMessage !== null && str_contains($error, 'during DATA body')) {
            $this->logMailError('SMTP text fallback failed, retrying minimal message: ' . $error . ' | ' . $this->smtpDebugContext($mail, $fromEmail));
            $minimalError = '';
            if ($this->trySendViaSmtp($mail, $fromEmail, $toEmail, $minimalMessage, $minimalError)) {
                return true;
            }
            $error = $minimalError;
        }

        $this->logMailError($error . ' | ' . $this->smtpDebugContext($mail, $fromEmail));
        return false;
    }

    private function trySendViaSmtp(array $mail, string $fromEmail, string $toEmail, string $message, string &$error): bool
    {
        $host = (string) ($mail['smtp_host'] ?? '');
        $port = (int) ($mail['smtp_port'] ?? 465);
        $encryption = strtolower((string) ($mail['smtp_encryption'] ?? 'ssl'));
        $timeout = max(5, (int) ($mail['smtp_timeout'] ?? 15));
        $remote = ($encryption === 'ssl' ? 'ssl://' : '') . $host . ':' . $port;

        try {
            $socket = @stream_socket_client($remote, $errno, $errstr, $timeout, STREAM_CLIENT_CONNECT);
            if (!is_resource($socket)) {
                throw new RuntimeException("SMTP connection failed: {$errno} {$errstr}");
            }

            stream_set_timeout($socket, $timeout);
            $this->smtpExpect($socket, [220], 'CONNECT');
            $this->smtpCommand($socket, 'EHLO ' . $this->smtpClientHost(), [250], 'EHLO');

            if (in_array($encryption, ['tls', 'starttls'], true)) {
                $this->smtpCommand($socket, 'STARTTLS', [220], 'STARTTLS');
                if (!stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                    throw new RuntimeException('SMTP STARTTLS failed.');
                }
                $this->smtpCommand($socket, 'EHLO ' . $this->smtpClientHost(), [250], 'EHLO after STARTTLS');
            }

            $this->smtpAuthenticate(
                $socket,
                (string) $mail['smtp_user'],
                (string) $mail['smtp_pass'],
                (string) ($mail['smtp_auth'] ?? 'login')
            );
            $this->smtpCommand($socket, 'MAIL FROM:<' . $this->cleanAddress($fromEmail) . '>', [250], 'MAIL FROM');
            $this->smtpCommand($socket, 'RCPT TO:<' . $this->cleanAddress($toEmail) . '>', [250, 251], 'RCPT TO');
            $this->smtpCommand($socket, 'DATA', [354], 'DATA');
            $this->smtpCommand($socket, $this->dotStuff($message) . "\r\n.", [250], 'DATA body');
            $this->smtpCommand($socket, 'QUIT', [221], 'QUIT');
            fclose($socket);

            return true;
        } catch (RuntimeException $exception) {
            if (isset($socket) && is_resource($socket)) {
                fclose($socket);
            }
            $error = $exception->getMessage();
            return false;
        }
    }

    /**
     * @param resource $socket
     */
    private function smtpAuthenticate($socket, string $username, string $password, string $mode = 'login'): void
    {
        $errors = [];
        $mode = strtolower($mode);

        if ($mode !== 'plain') {
            try {
                $this->smtpCommand($socket, 'AUTH LOGIN', [334], 'AUTH LOGIN');
                $this->smtpCommand($socket, base64_encode($username), [334], 'AUTH LOGIN username');
                $this->smtpCommand($socket, base64_encode($password), [235], 'AUTH LOGIN password');
                return;
            } catch (RuntimeException $exception) {
                $errors[] = 'AUTH LOGIN failed: ' . $exception->getMessage();
            }
        }

        if ($mode !== 'login') {
            try {
                $plain = base64_encode("\0{$username}\0{$password}");
                $this->smtpCommand($socket, 'AUTH PLAIN ' . $plain, [235], 'AUTH PLAIN');
                return;
            } catch (RuntimeException $exception) {
                $errors[] = 'AUTH PLAIN failed: ' . $exception->getMessage();
            }
        }

        throw new RuntimeException('SMTP authentication failed for user ' . $username . ': ' . implode(' | ', $errors));
    }

    /**
     * @param resource $socket
     * @param array<int> $expectedCodes
     */
    private function smtpCommand($socket, string $command, array $expectedCodes, string $label): string
    {
        fwrite($socket, $command . "\r\n");

        return $this->smtpExpect($socket, $expectedCodes, $label);
    }

    /**
     * @param resource $socket
     * @param array<int> $expectedCodes
     */
    private function smtpExpect($socket, array $expectedCodes, string $label): string
    {
        $response = '';
        while (($line = fgets($socket, 515)) !== false) {
            $response .= $line;
            if (preg_match('/^\d{3}\s/', $line)) {
                break;
            }
        }

        $code = (int) substr($response, 0, 3);
        if (!in_array($code, $expectedCodes, true)) {
            throw new RuntimeException('SMTP unexpected response during ' . $label . ': ' . trim($response));
        }

        return $response;
    }

    private function smtpClientHost(): string
    {
        $host = parse_url((string) ($this->config['url'] ?? ''), PHP_URL_HOST);
        return is_string($host) && $host !== '' ? $host : 'localhost';
    }

    private function smtpDebugContext(array $mail, string $fromEmail): string
    {
        $password = (string) ($mail['smtp_pass'] ?? '');

        return 'SMTP context: host=' . (string) ($mail['smtp_host'] ?? '')
            . '; port=' . (string) ($mail['smtp_port'] ?? '')
            . '; encryption=' . (string) ($mail['smtp_encryption'] ?? '')
            . '; auth=' . (string) ($mail['smtp_auth'] ?? '')
            . '; user=' . (string) ($mail['smtp_user'] ?? '')
            . '; from=' . $fromEmail
            . '; pass_len=' . strlen($password);
    }

    private function cleanHeader(string $value): string
    {
        return str_replace(["\r", "\n"], '', $value);
    }

    private function cleanAddress(string $value): string
    {
        return preg_replace('/[^a-z0-9._%+\-@]/i', '', $value) ?: $value;
    }

    private function normalizeNewlines(string $value): string
    {
        return str_replace(["\r\n", "\r", "\n"], "\r\n", $value);
    }

    private function base64Body(string $value): string
    {
        return rtrim(chunk_split(base64_encode($this->normalizeNewlines($value)), 76, "\r\n"));
    }

    private function messageId(string $fromEmail): string
    {
        $domain = substr(strrchr($fromEmail, '@') ?: '', 1) ?: $this->smtpClientHost();
        $domain = preg_replace('/[^a-z0-9.-]/i', '', $domain) ?: 'localhost';

        return '<' . bin2hex(random_bytes(16)) . '@' . $domain . '>';
    }

    private function dotStuff(string $message): string
    {
        return preg_replace('/^\./m', '..', $this->normalizeNewlines($message)) ?? $message;
    }

    private function logMailError(string $message): void
    {
        $this->logMailLine($message);
    }

    private function logMailInfo(string $message): void
    {
        $this->logMailLine($message);
    }

    private function logMailLine(string $message): void
    {
        $dir = REACTOR_ROOT . '/storage/logs';
        if (!is_dir($dir)) {
            mkdir($dir, 0775, true);
        }

        file_put_contents($dir . '/mail.log', '[' . date('c') . '] ' . $message . PHP_EOL, FILE_APPEND);
    }

    private function shortLog(string $value): string
    {
        $value = trim(str_replace(["\r", "\n"], ' ', $value));

        return strlen($value) > 700 ? substr($value, 0, 700) . '...' : $value;
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
