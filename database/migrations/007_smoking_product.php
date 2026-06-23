<?php
declare(strict_types=1);

return [
    'ALTER TABLE habits
        ADD COLUMN smoking_product ENUM("tobacco","vape") NOT NULL DEFAULT "tobacco" AFTER current_streak_start_at,
        ADD COLUMN vape_weekly_spend DECIMAL(10,2) NULL AFTER pack_price',
];
