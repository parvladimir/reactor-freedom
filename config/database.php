<?php
declare(strict_types=1);

use Reactor\Helpers\Env;

return [
    'host' => Env::get('DB_HOST', '127.0.0.1'),
    'database' => Env::get('DB_NAME', 'reactor_freedom'),
    'username' => Env::get('DB_USER', 'root'),
    'password' => Env::get('DB_PASS', ''),
    'charset' => Env::get('DB_CHARSET', 'utf8mb4'),
];
