<?php
declare(strict_types=1);

return [
    'ALTER TABLE users
        ADD COLUMN avatar_code VARCHAR(24) NOT NULL DEFAULT "pulse" AFTER language',
];
