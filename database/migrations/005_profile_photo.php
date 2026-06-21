<?php
declare(strict_types=1);

return [
    'ALTER TABLE users
        ADD COLUMN avatar_file VARCHAR(190) NULL AFTER avatar_code,
        ADD COLUMN avatar_mime VARCHAR(40) NULL AFTER avatar_file',
];
