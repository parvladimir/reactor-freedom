<?php
declare(strict_types=1);

use Reactor\Helpers\Env;

return [
    'name' => 'REACTOR: Freedom',
    'env' => Env::get('APP_ENV', 'production'),
    'url' => rtrim((string) Env::get('APP_URL', ''), '/'),
    'session_name' => Env::get('SESSION_NAME', 'reactor_session'),
    'languages' => ['ru', 'en', 'de'],
    'default_language' => 'en',
    'mail' => [
        'from_email' => Env::get('MAIL_FROM', 'noreply@reactor.local'),
        'from_name' => Env::get('MAIL_FROM_NAME', 'REACTOR: Freedom'),
        'smtp_host' => Env::get('SMTP_HOST', ''),
        'smtp_port' => (int) Env::get('SMTP_PORT', 465),
        'smtp_encryption' => strtolower((string) Env::get('SMTP_ENCRYPTION', 'ssl')),
        'smtp_user' => Env::get('SMTP_USER', ''),
        'smtp_pass' => Env::get('SMTP_PASS', ''),
        'smtp_timeout' => (int) Env::get('SMTP_TIMEOUT', 15),
    ],
];
