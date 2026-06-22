<?php
declare(strict_types=1);

return [
    'ALTER TABLE user_profiles
        ADD COLUMN motivation_reasons JSON NULL AFTER main_reason',

    'UPDATE user_profiles
     SET motivation_reasons = JSON_ARRAY(main_reason)
     WHERE main_reason <> "" AND motivation_reasons IS NULL',
];
