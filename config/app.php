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
];
